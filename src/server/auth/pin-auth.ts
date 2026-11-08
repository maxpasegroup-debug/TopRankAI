import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/server/db";
import { atomic, type Tx } from "@/server/commerce/transaction";
import { ApiError, AuthenticationApiError, ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { assertAccountPolicyReady, childEmailHash, prepareAccountConsent } from "./account-consent";
import { adultConsentWhere } from "./sharing";
import { createSession, createSessionToken, hashSessionToken } from "./session";
import { hashPassword, verifyPassword } from "./password";
import { AuthThrottleError } from "./request-security";
import { mobileSchema, registrationSchema, pinRequestSchema } from "./pin-validation";
import { ACCOUNT_POLICY_VERSION, needsGuardian } from "@/shared/account-policy";

type Registration = z.infer<typeof registrationSchema>;
const WINDOW = 15 * 60 * 1000;
const unavailable = () => new ApiError(503, "PIN_UNAVAILABLE", "PIN authentication is temporarily unavailable");
const invalid = () => new ValidationApiError("Code or authorization is invalid or expired. Request a new code.");
export function assertPinReady() {
  if (process.env.AUTH_PIN_ENABLED !== "true" || !process.env.AUTH_PIN_HMAC_KEY || process.env.AUTH_PIN_HMAC_KEY.length < 32) throw unavailable();
}
function digest(value: string) { assertPinReady(); return createHmac("sha256", process.env.AUTH_PIN_HMAC_KEY!).update(value).digest("hex"); }
function matches(left: string, right: string) { return /^[a-f0-9]{64}$/.test(left) && timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex")); }
function binding(input: Registration) { return digest("registration:" + JSON.stringify(registrationSchema.parse(input))); }
function proofFor(challenge: string) { return createHmac("sha256", process.env.AUTH_PIN_HMAC_KEY!).update("grant:" + challenge).digest("base64url"); }
function assertPinEmailReady() {
  assertPinReady();
  if (process.env.AUTH_PIN_EMAIL_VERIFIED !== "true" || process.env.AUTH_EMAIL_PROVIDER !== "resend" || !process.env.RESEND_API_KEY || !z.email().safeParse(process.env.AUTH_EMAIL_FROM).success) throw unavailable();
}
export async function sendPinOtp(email: string, code: string, id: string, fetcher: typeof fetch = fetch) {
  assertPinEmailReady();
  try {
    const response = await fetcher("https://api.resend.com/emails", { method: "POST", redirect: "error", signal: AbortSignal.timeout(7000),
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": "pin-otp/" + id },
      body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [email], subject: "Your TopRank AI verification code",
        text: `Your TopRank AI email verification code is ${code}. It expires in 10 minutes. Never share this code or your PIN. If you did not request this, ignore this email.` }) });
    if (!response.ok) throw unavailable();
    const body = await response.json(); if (!z.object({ id: z.string().min(1).max(200) }).safeParse(body).success) throw unavailable();
  } catch { throw unavailable(); }
}
async function checkMinor(input: Registration, tx: Tx) {
  if (!needsGuardian(input.ageBand)) { if (input.guardianApproval) throw invalid(); return; }
  if (process.env.ACCOUNT_GUARDIAN_VERIFICATION_APPROVED !== "true") throw unavailable();
  if (!await tx.guardianRegistrationGrant.findFirst({ where: { tokenHash: hashSessionToken(input.guardianApproval!), childEmailHash: childEmailHash(input.email),
    country: input.country, policyVersion: ACCOUNT_POLICY_VERSION, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() },
    guardian: { role: "PARENT", status: "ACTIVE", accountConsent: { is: adultConsentWhere() } } }, select: { id: true } })) throw invalid();
}
export async function requestPinOtp(email: string, registration?: Registration, send = sendPinOtp) {
  assertPinReady();
  // No PII persistence or provider call before the approved email workflow is enabled.
  assertPinEmailReady();
  const purpose = registration ? "SIGNUP" : "RESET";
  if (registration) assertAccountPolicyReady();
  const challenge = createSessionToken(), id = randomUUID(), code = randomInt(0, 1000000).toString().padStart(6, "0");
  await atomic(async tx => {
    if (registration) await checkMinor(registration, tx);
    const recent = { email, purpose, createdAt: { gt: new Date(Date.now() - WINDOW) } };
    if (await tx.emailOtpChallenge.count({ where: recent }) >= 3) throw new AuthThrottleError(900);
    if (await tx.emailOtpChallenge.count({ where: { email, purpose, createdAt: { gt: new Date(Date.now() - 86400000) } } }) >= 10) throw new AuthThrottleError(86400);
    if (await tx.emailOtpChallenge.count({ where: { email, purpose, createdAt: { gt: new Date(Date.now() - 60000) } } })) throw new AuthThrottleError(60);
    const candidate = registration ? null : await tx.user.findFirst({ where: { email, role: "STUDENT", status: "ACTIVE", phone: { not: null } }, select: { id: true, pinVersion: true, phone: true } });
    const user = candidate && mobileSchema.safeParse(candidate.phone).success ? candidate : null;
    await tx.emailOtpChallenge.create({ data: { id, tokenHash: hashSessionToken(challenge), purpose, email,
      bindingHash: registration ? binding(registration) : user ? digest("reset-phone:" + user.phone) : null, codeHash: digest(id + ":" + code),
      expiresAt: new Date(Date.now() + 10 * 60000), userId: user?.id, pinVersion: user?.pinVersion } });
  });
  try { await send(email, code, id); }
  catch { await prisma.emailOtpChallenge.updateMany({ where: { id, deliveryState: "PENDING" }, data: { deliveryState: "FAILED" } }); throw unavailable(); }
  await prisma.emailOtpChallenge.updateMany({ where: { id, deliveryState: "PENDING" }, data: { deliveryState: "SENT" } });
  // Every valid address gets the same verification email, whether or not it has an account.
  return { challenge, expiresIn: 600, resendAfter: 60, message: "Check your email for a six-digit code." };
}
export async function verifyPinOtp(challenge: string, code: string) {
  assertPinReady();
  const proof = proofFor(challenge);
  const valid = await atomic(async tx => {
    const row = await tx.emailOtpChallenge.findUnique({ where: { tokenHash: hashSessionToken(challenge) } });
    if (!row || row.consumedAt || row.expiresAt <= new Date() || row.deliveryState !== "SENT" || row.attempts >= 5) return false;
    const correct = matches(row.codeHash, digest(row.id + ":" + code));
    if (row.verifiedAt && correct) return matches(row.proofHash ?? "", hashSessionToken(proof));
    await tx.emailOtpChallenge.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, ...(correct ? { verifiedAt: new Date(), proofHash: hashSessionToken(proof), expiresAt: new Date(Date.now() + 5 * 60000) } : {}) } });
    return correct;
  });
  // Throw outside the transaction so a wrong code's attempt counter is committed.
  if (!valid) throw invalid();
  return { proof, expiresIn: 300 };
}
async function claim(tx: Tx, challenge: string, proof: string, purpose: string) {
  const where = { tokenHash: hashSessionToken(challenge), proofHash: hashSessionToken(proof), purpose, deliveryState: "SENT", verifiedAt: { not: null }, consumedAt: null, expiresAt: { gt: new Date() } };
  const row = await tx.emailOtpChallenge.findFirst({ where });
  if (!row || (await tx.emailOtpChallenge.updateMany({ where: { ...where, id: row.id }, data: { consumedAt: new Date() } })).count !== 1) throw invalid();
  return row;
}
export async function finishPinSignup(input: Extract<z.infer<typeof pinRequestSchema>, { action: "signup" }>) {
  assertPinReady(); assertAccountPolicyReady();
  const pinHash = await hashPassword(input.pin), passwordHash = await hashPassword(createSessionToken());
  return atomic(async tx => {
    const row = await claim(tx, input.challenge, input.proof, "SIGNUP");
    if (!matches(row.bindingHash ?? "", binding(input.registration)) || row.email !== input.registration.email) throw invalid();
    if (await tx.user.findFirst({ where: { OR: [{ email: row.email }, { phone: input.registration.phone }] }, select: { id: true } })) throw new ConflictApiError("Account details are unavailable. Log in or contact support.");
    const saveConsent = await prepareAccountConsent(tx, row.email, input.registration);
    const user = await tx.user.create({ data: { name: input.registration.name, email: row.email, phone: input.registration.phone,
      passwordHash, pinHash, emailVerifiedAt: new Date(), role: "STUDENT" } });
    await tx.studentProfile.create({ data: { userId: user.id } }); await saveConsent(user.id);
    const session = await createSession(user.id, tx);
    return { user: { id: user.id, name: user.name, role: user.role }, session };
  });
}
export async function finishPinReset(input: Extract<z.infer<typeof pinRequestSchema>, { action: "reset" }>) {
  assertPinReady(); const pinHash = await hashPassword(input.pin), passwordHash = await hashPassword(createSessionToken());
  return atomic(async tx => {
    const row = await claim(tx, input.challenge, input.proof, "RESET"); if (!row.userId) throw invalid();
    const user = await tx.user.findFirst({ where: { id: row.userId, email: row.email, role: "STUDENT", status: "ACTIVE", pinVersion: row.pinVersion ?? -1 }, select: { phone: true } });
    if (!user || !mobileSchema.safeParse(user.phone).success || !matches(row.bindingHash ?? "", digest("reset-phone:" + user.phone))) throw invalid();
    const changed = await tx.user.updateMany({ where: { id: row.userId, email: row.email, role: "STUDENT", status: "ACTIVE", pinVersion: row.pinVersion ?? -1, phone: user.phone },
      data: { pinHash, passwordHash, emailVerifiedAt: new Date(), pinVersion: { increment: 1 } } });
    if (changed.count !== 1) throw invalid();
    await tx.pinAttemptWindow.updateMany({ where: { id: { in: [digest("login:" + user.phone), digest("login-day:" + user.phone)] } }, data: { count: 0 } });
    await tx.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.passwordReset.updateMany({ where: { userId: row.userId, consumedAt: null }, data: { consumedAt: new Date(), deliveryPayload: null } });
    await tx.emailOtpChallenge.updateMany({ where: { userId: row.userId, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: row.userId, action: "ACCOUNT_PIN_RESET", entity: "User", entityId: row.userId } });
    return { reset: true };
  });
}
let dummyHash: Promise<string> | undefined;
export async function loginWithPin(phone: string, pin: string) {
  assertPinReady();
  await atomic(async tx => {
    for (const budget of [{ tag: "login:", limit: 5, ms: WINDOW }, { tag: "login-day:", limit: 10, ms: 86400000 }]) {
      const id = digest(budget.tag + phone), row = await tx.pinAttemptWindow.findUnique({ where: { id } });
      if (row && row.endsAt > new Date() && row.count >= budget.limit) throw new AuthThrottleError(Math.max(1, Math.ceil((row.endsAt.getTime() - Date.now()) / 1000)));
      if (!row || row.endsAt <= new Date()) await tx.pinAttemptWindow.upsert({ where: { id }, create: { id, count: 1, endsAt: new Date(Date.now() + budget.ms) }, update: { count: 1, endsAt: new Date(Date.now() + budget.ms) } });
      else await tx.pinAttemptWindow.update({ where: { id }, data: { count: { increment: 1 } } });
    }
  });
  const user = await prisma.user.findFirst({ where: { phone, role: "STUDENT", status: "ACTIVE", pinHash: { not: null } } });
  dummyHash ??= hashPassword("not-a-real-account-pin");
  if (!await verifyPassword(pin, user?.pinHash ?? await dummyHash) || !user) throw new AuthenticationApiError("Invalid mobile number or PIN");
  return atomic(async tx => {
    if (!await tx.user.findFirst({ where: { id: user.id, phone, role: "STUDENT", status: "ACTIVE", pinHash: user.pinHash, pinVersion: user.pinVersion }, select: { id: true } })) throw new AuthenticationApiError("Invalid mobile number or PIN");
    const session = await createSession(user.id, tx);
    await tx.pinAttemptWindow.updateMany({ where: { id: { in: [digest("login:" + phone), digest("login-day:" + phone)] } }, data: { count: 0 } });
    return { user: { id: user.id, name: user.name, role: user.role }, session };
  });
}
