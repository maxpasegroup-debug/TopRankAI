import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
import { pinRequestSchema, pinSchema, registrationSchema } from "@/server/auth/pin-validation";
import { finishPinReset, finishPinSignup, loginWithPin, requestPinOtp, sendPinOtp, verifyPinOtp } from "@/server/auth/pin-auth";
const db = vi.hoisted(() => {
  const model = () => ({ findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() });
  return { $transaction: vi.fn(), emailOtpChallenge: model(), pinAttemptWindow: model(), user: model(), session: model(), studentProfile: model(), accountConsent: model(), guardianRegistrationGrant: model(), passwordReset: model(), auditEvent: model() };
});
const passwords = vi.hoisted(() => ({ hash: vi.fn(), verify: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: db }));
vi.mock("@/server/auth/password", () => ({ hashPassword: passwords.hash, verifyPassword: passwords.verify }));
type Row = Record<string, any>;
let row: Row | null;
const registration = registrationSchema.parse({ name: "Student", phone: "+919876543210", email: "STUDENT@example.com", country: "IN", ageBand: "18_PLUS", termsAccepted: true, privacyAccepted: true, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION });
beforeEach(() => {
  vi.resetAllMocks(); row = null;
  vi.stubEnv("AUTH_PIN_ENABLED", "true"); vi.stubEnv("AUTH_PIN_HMAC_KEY", "test-only-hmac-key-".repeat(3)); vi.stubEnv("AUTH_PIN_EMAIL_VERIFIED", "true"); vi.stubEnv("ACCOUNT_POLICY_REVIEWED", "true");
  vi.stubEnv("AUTH_EMAIL_PROVIDER", "resend"); vi.stubEnv("AUTH_EMAIL_FROM", "sender@example.com"); vi.stubEnv("RESEND_API_KEY", "test-only-provider-key");
  for (const model of Object.values(db)) if (typeof model === "object") { model.findFirst.mockResolvedValue(null); model.findUnique.mockResolvedValue(null); model.count.mockResolvedValue(0); model.updateMany.mockResolvedValue({ count: 1 }); }
  db.$transaction.mockImplementation(fn => fn(db)); passwords.hash.mockImplementation(async value => "hashed:" + value); passwords.verify.mockResolvedValue(true);
  db.emailOtpChallenge.create.mockImplementation(async ({ data }) => { row = { attempts: 0, deliveryState: "PENDING", consumedAt: null, verifiedAt: null, ...data }; return row; });
  db.emailOtpChallenge.findUnique.mockImplementation(async () => row);
  db.emailOtpChallenge.findFirst.mockImplementation(async () => row);
  db.emailOtpChallenge.update.mockImplementation(async ({ data }) => { if (row) { if (data.attempts) row.attempts++; Object.assign(row, { ...data, attempts: row.attempts }); } return row; });
  db.emailOtpChallenge.updateMany.mockImplementation(async ({ data }) => { if (row) Object.assign(row, data); return { count: 1 }; });
  db.user.create.mockImplementation(async ({ data }) => ({ id: "student-1", ...data }));
});
afterEach(() => vi.unstubAllEnvs());
async function verified(reset = false) {
  const send = vi.fn().mockResolvedValue(undefined);
  const start = await requestPinOtp(registration.email, reset ? undefined : registration, send);
  const code = send.mock.calls[0][1]; const result = await verifyPinOtp(start.challenge, code);
  return { start, code, proof: result.proof, send };
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

describe("email OTP and mobile/PIN service (mocked persistence and mail)", () => {
  it.each(["PLATFORM_ADMIN", "TEACHER", "PARENT", "SCHOOL_ADMIN"])("rejects public %s registration", role => expect(registrationSchema.safeParse({ ...registration, role }).success).toBe(false));
  it.each(["000000", "111111", "123456", "654321", "12345", "1234567", "abcdef"])("rejects predictable or malformed PIN %s", pin => expect(pinSchema.safeParse(pin).success).toBe(false));
  it("rejects confirmation mismatch and unrecognized status claims", () => {
    expect(pinRequestSchema.safeParse({ action: "reset", challenge: "a".repeat(43), proof: "b".repeat(43), pin: "482619", confirmPin: "482610" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...registration, emailVerified: true }).success).toBe(false);
  });
  it("defaults to student, normalizes email, and requires an international number", () => {
    expect(registration.role).toBe("STUDENT"); expect(registration.email).toBe("student@example.com");
    for (const phone of ["9876543210", "+91 9876543210", "+012345678", "+123"]) expect(registrationSchema.safeParse({ ...registration, phone }).success).toBe(false);
  });
  it.each(["AUTH_PIN_ENABLED", "AUTH_PIN_EMAIL_VERIFIED"])("fails before persistence or sending without %s approval", async flag => {
    vi.stubEnv(flag, "false"); const send = vi.fn(); await expect(requestPinOtp(registration.email, registration, send)).rejects.toThrow("temporarily unavailable");
    expect(db.$transaction).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it("stores keyed OTP hashes and a hashed browser challenge, never the code or PIN", async () => {
    const send = vi.fn().mockResolvedValue(undefined); const result = await requestPinOtp(registration.email, registration, send);
    const sentCode = send.mock.calls[0][1]; expect(sentCode).toMatch(/^\d{6}$/);
    expect(row?.codeHash).toMatch(/^[a-f0-9]{64}$/); expect(row?.codeHash).not.toBe(sha(sentCode));
    expect(row?.tokenHash).toBe(sha(result.challenge)); expect(JSON.stringify(result)).not.toContain(sentCode);
    expect(db.user.create).not.toHaveBeenCalled(); expect(db.studentProfile.create).not.toHaveBeenCalled(); expect(db.session.create).not.toHaveBeenCalled();
  });
  it.each([1, 3])("limits cooldown/quota before sending (count %s)", async count => {
    db.emailOtpChallenge.count.mockResolvedValue(count); const send = vi.fn(); await expect(requestPinOtp(registration.email, registration, send)).rejects.toThrow("Too many requests");
    expect(send).not.toHaveBeenCalled(); expect(db.emailOtpChallenge.create).not.toHaveBeenCalled();
  });
  it("requires real guardian authority before persisting a minor challenge", async () => {
    vi.stubEnv("ACCOUNT_GUARDIAN_VERIFICATION_APPROVED", "true"); vi.stubEnv("AUTH_CONSENT_HMAC_KEY", "test-only-consent-key-".repeat(3));
    const minor = registrationSchema.parse({ ...registration, ageBand: "UNDER_13", guardianApproval: "a".repeat(43) });
    await expect(requestPinOtp(minor.email, minor, vi.fn())).rejects.toThrow("invalid or expired"); expect(db.emailOtpChallenge.create).not.toHaveBeenCalled();
    expect(db.guardianRegistrationGrant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ childEmailHash: expect.any(String), guardian: expect.objectContaining({ role: "PARENT", status: "ACTIVE", accountConsent: expect.any(Object) }) }) }));
  });
  it("commits a wrong-code attempt without creating an account or session", async () => {
    const { start, code } = await verified(); row!.verifiedAt = null; row!.attempts = 0;
    await expect(verifyPinOtp(start.challenge, code === "000000" ? "999999" : "000000")).rejects.toThrow("invalid or expired");
    expect(row?.attempts).toBe(1); expect(db.user.create).not.toHaveBeenCalled(); expect(db.session.create).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
  it.each(["expired", "locked", "failed", "consumed", "missing"])("rejects %s OTP challenges", async failure => {
    const { start, code } = await verified();
    if (failure === "expired") row!.expiresAt = new Date(0); if (failure === "locked") row!.attempts = 5;
    if (failure === "failed") row!.deliveryState = "FAILED"; if (failure === "consumed") row!.consumedAt = new Date(); if (failure === "missing") row = null;
    await expect(verifyPinOtp(start.challenge, code)).rejects.toThrow("invalid or expired"); expect(db.session.create).not.toHaveBeenCalled();
  });
  it("returns the same proof on a repeated correct verification without extending its life", async () => {
    const { start, code, proof } = await verified(); const expires = row!.expiresAt;
    expect(await verifyPinOtp(start.challenge, code)).toEqual({ proof, expiresIn: 300 }); expect(row!.expiresAt).toBe(expires);
  });
  it("creates only a student with hashed PIN, verified email, required profile, consent and session", async () => {
    const { start, proof } = await verified(); const result = await finishPinSignup({ action: "signup", challenge: start.challenge, proof, registration, pin: "482619", confirmPin: "482619" });
    expect(db.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ role: "STUDENT", email: registration.email, phone: registration.phone, pinHash: "hashed:482619", emailVerifiedAt: expect.any(Date) }) });
    expect(db.user.create.mock.calls[0][0].data.passwordHash).not.toBe("hashed:482619");
    expect(db.studentProfile.create).toHaveBeenCalledWith({ data: { userId: "student-1" } }); expect(db.accountConsent.upsert).toHaveBeenCalledOnce();
    expect(db.session.create).toHaveBeenCalledOnce(); expect(result.user).toEqual({ id: "student-1", name: "Student", role: "STUDENT" });
  });
  it("rejects changed registration details after email verification", async () => {
    const { start, proof } = await verified();
    await expect(finishPinSignup({ action: "signup", challenge: start.challenge, proof, registration: { ...registration, phone: "+971501234567" }, pin: "482619", confirmPin: "482619" })).rejects.toThrow("invalid or expired");
    expect(db.user.create).not.toHaveBeenCalled(); expect(db.session.create).not.toHaveBeenCalled();
  });
  it("rejects duplicate email/phone before creating records", async () => {
    const { start, proof } = await verified(); db.user.findFirst.mockResolvedValue({ id: "existing" });
    await expect(finishPinSignup({ action: "signup", challenge: start.challenge, proof, registration, pin: "482619", confirmPin: "482619" })).rejects.toThrow("unavailable"); expect(db.user.create).not.toHaveBeenCalled();
  });
  it("cannot finalize an absent, expired or already-claimed grant", async () => {
    const { start, proof } = await verified(); db.emailOtpChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(finishPinSignup({ action: "signup", challenge: start.challenge, proof, registration, pin: "482619", confirmPin: "482619" })).rejects.toThrow("invalid or expired"); expect(db.user.create).not.toHaveBeenCalled();
    expect(db.emailOtpChallenge.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ purpose: "SIGNUP", tokenHash: sha(start.challenge), proofHash: sha(proof), verifiedAt: { not: null }, consumedAt: null, expiresAt: { gt: expect.any(Date) } }) });
  });
  it("sends the same verification flow for an unknown reset email without creating an account", async () => {
    const send = vi.fn().mockResolvedValue(undefined); const result = await requestPinOtp("unknown@example.com", undefined, send);
    expect(result).toMatchObject({ expiresIn: 600, resendAfter: 60 }); expect(send).toHaveBeenCalledOnce();
    expect(row?.userId).toBeUndefined(); expect(db.user.create).not.toHaveBeenCalled();
  });
  it("resets only the bound current student and invalidates sessions and both recovery mechanisms", async () => {
    db.user.findFirst.mockResolvedValue({ id: "student-1", pinVersion: 2, phone: registration.phone }); const { start, proof } = await verified(true);
    expect(await finishPinReset({ action: "reset", challenge: start.challenge, proof, pin: "482619", confirmPin: "482619" })).toEqual({ reset: true });
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: "student-1", email: registration.email, pinVersion: 2, role: "STUDENT", status: "ACTIVE", phone: registration.phone }), data: expect.objectContaining({ pinHash: "hashed:482619", pinVersion: { increment: 1 } }) });
    expect(db.session.updateMany).toHaveBeenCalledOnce(); expect(db.passwordReset.updateMany).toHaveBeenCalledOnce(); expect(db.auditEvent.create).toHaveBeenCalledOnce();
    expect(db.pinAttemptWindow.updateMany).toHaveBeenCalledWith({ where: { id: { in: [expect.stringMatching(/^[a-f0-9]{64}$/), expect.stringMatching(/^[a-f0-9]{64}$/)] } }, data: { count: 0 } });
    expect(db.session.create).not.toHaveBeenCalled();
  });
  it("does not reset a missing account or an account whose PIN version changed", async () => {
    const { start, proof } = await verified(true);
    await expect(finishPinReset({ action: "reset", challenge: start.challenge, proof, pin: "482619", confirmPin: "482619" })).rejects.toThrow();
    row!.userId = "student-1"; row!.pinVersion = 1; db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(finishPinReset({ action: "reset", challenge: start.challenge, proof, pin: "482619", confirmPin: "482619" })).rejects.toThrow(); expect(db.session.create).not.toHaveBeenCalled();
  });
  it("does not silently convert a legacy national-format mobile to an unusable PIN account", async () => {
    db.user.findFirst.mockResolvedValue({ id: "student-1", pinVersion: 0, phone: "9876543210" });
    const { start, proof } = await verified(true); expect(row?.userId).toBeUndefined();
    await expect(finishPinReset({ action: "reset", challenge: start.challenge, proof, pin: "482619", confirmPin: "482619" })).rejects.toThrow();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it("rejects recovery if the mobile changed after the email challenge was issued", async () => {
    db.user.findFirst.mockResolvedValue({ id: "student-1", pinVersion: 0, phone: registration.phone });
    const { start, proof } = await verified(true);
    db.user.findFirst.mockResolvedValue({ phone: "+971501234567" });
    await expect(finishPinReset({ action: "reset", challenge: start.challenge, proof, pin: "482619", confirmPin: "482619" })).rejects.toThrow();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it("caps PIN guesses across clients before lookup or bcrypt", async () => {
    db.pinAttemptWindow.findUnique.mockResolvedValue({ count: 5, endsAt: new Date(Date.now() + 10000) });
    await expect(loginWithPin(registration.phone, "482619")).rejects.toThrow("Too many requests"); expect(db.user.findFirst).not.toHaveBeenCalled(); expect(passwords.verify).not.toHaveBeenCalled();
  });
  it("uses a dummy hash for an unknown mobile and does not create a session", async () => {
    await expect(loginWithPin(registration.phone, "482619")).rejects.toThrow("Invalid mobile number or PIN"); expect(passwords.verify).toHaveBeenCalled(); expect(db.session.create).not.toHaveBeenCalled();
  });
  it("enforces the cross-client daily guessing cap even when the short window is fresh", async () => {
    db.pinAttemptWindow.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ count: 10, endsAt: new Date(Date.now() + 60000) });
    await expect(loginWithPin(registration.phone, "482619")).rejects.toThrow("Too many requests"); expect(db.user.findFirst).not.toHaveBeenCalled();
  });
  it("creates a session only after rechecking active role, PIN and credential version", async () => {
    db.user.findFirst.mockResolvedValue({ id: "student-1", name: "Student", role: "STUDENT", pinHash: "hashed:482619", pinVersion: 3 });
    const result = await loginWithPin(registration.phone, "482619"); expect(result.user.id).toBe("student-1");
    expect(db.user.findFirst).toHaveBeenLastCalledWith({ where: expect.objectContaining({ id: "student-1", role: "STUDENT", status: "ACTIVE", pinHash: "hashed:482619", pinVersion: 3 }), select: { id: true } });
    expect(db.session.create).toHaveBeenCalledOnce();
  });
  it("rejects a wrong PIN without resetting the guessing counter", async () => {
    db.user.findFirst.mockResolvedValue({ id: "student-1", pinHash: "hash" }); passwords.verify.mockResolvedValue(false);
    await expect(loginWithPin(registration.phone, "482619")).rejects.toThrow(); expect(db.session.create).not.toHaveBeenCalled(); expect(db.pinAttemptWindow.updateMany).not.toHaveBeenCalled();
  });
  it("sends through fixed Resend TLS endpoint with timeout, redirect rejection and idempotency key", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "test-message" })); await sendPinOtp(registration.email, "042319", "test-challenge", fetcher);
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal), headers: expect.objectContaining({ "idempotency-key": "pin-otp/test-challenge" }) }));
    expect(JSON.parse(fetcher.mock.calls[0][1].body).text).toContain("042319");
  });
  it.each(["reject", "malformed", "error"])("sanitizes Resend %s failure", async failure => {
    const fetcher = failure === "error" ? vi.fn().mockRejectedValue(new Error("provider-secret")) : vi.fn().mockResolvedValue(Response.json(failure === "malformed" ? {} : { message: "provider-secret" }, { status: failure === "reject" ? 403 : 200 }));
    await expect(sendPinOtp(registration.email, "042319", "test", fetcher)).rejects.toThrow("temporarily unavailable");
  });
});
