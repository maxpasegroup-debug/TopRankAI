import { createHmac } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { ApiError, AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import { ACCOUNT_POLICY_VERSION, needsGuardian } from "@/shared/account-policy";
import { accountConsentSchema } from "./validation";
import { createSessionToken, hashSessionToken, type AuthUser } from "./session";

type ConsentInput = z.infer<typeof accountConsentSchema>;
type Receipt = { termsVersion: string; privacyVersion: string; revokedAt: Date | null; ageBand: string;
  guardianGrant?: { revokedAt: Date | null; policyVersion: string; usedAt: Date | null; guardian: { status: string } } | null } | null;
export function isConsentCurrent(receipt: Receipt) {
  return Boolean(receipt && !receipt.revokedAt && receipt.termsVersion === ACCOUNT_POLICY_VERSION && receipt.privacyVersion === ACCOUNT_POLICY_VERSION &&
    (receipt.ageBand === "18_PLUS" || receipt.guardianGrant && !receipt.guardianGrant.revokedAt && receipt.guardianGrant.usedAt && receipt.guardianGrant.policyVersion === ACCOUNT_POLICY_VERSION && receipt.guardianGrant.guardian.status === "ACTIVE"));
}
export function assertAccountPolicyReady() {
  if (process.env.ACCOUNT_POLICY_REVIEWED !== "true") {
    throw new ApiError(503, "ACCOUNT_UNAVAILABLE", "Account registration is temporarily unavailable");
  }
}
export function childEmailHash(email: string) {
  const key = process.env.AUTH_CONSENT_HMAC_KEY;
  if (!key || key.length < 32) throw new ApiError(503, "ACCOUNT_UNAVAILABLE", "Account registration is temporarily unavailable");
  return createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
}

export async function prepareAccountConsent(tx: Prisma.TransactionClient, email: string, input: ConsentInput) {
  let guardianGrantId: string | undefined;
  if (needsGuardian(input.ageBand)) {
    if (!input.guardianApproval) throw new ValidationApiError("Verified guardian authorization is required");
    const where = { tokenHash: hashSessionToken(input.guardianApproval), childEmailHash: childEmailHash(email), country: input.country,
      policyVersion: ACCOUNT_POLICY_VERSION, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, guardian: { role: "PARENT" as const, status: "ACTIVE" as const } };
    const grant = await tx.guardianRegistrationGrant.findFirst({ where });
    if (!grant) throw new ValidationApiError("Guardian authorization is invalid or unavailable");
    const claimed = await tx.guardianRegistrationGrant.updateMany({ where: { ...where, id: grant.id }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new ValidationApiError("Guardian authorization is invalid or unavailable");
    guardianGrantId = grant.id;
  } else if (input.guardianApproval) throw new ValidationApiError("Guardian authorization is not applicable to this age group");
  return async (userId: string) => {
  const receipt = await tx.accountConsent.upsert({ where: { userId }, create: { userId, country: input.country, ageBand: input.ageBand,
    termsVersion: input.termsVersion, privacyVersion: input.privacyVersion, guardianGrantId },
    update: { country: input.country, ageBand: input.ageBand, termsVersion: input.termsVersion,
      privacyVersion: input.privacyVersion, guardianGrantId: guardianGrantId ?? null, acceptedAt: new Date(), revokedAt: null } });
  await tx.auditEvent.create({ data: { actorId: userId, action: "ACCOUNT_CONSENT_ACCEPTED", entity: "User", entityId: userId,
    detail: JSON.stringify({ country: input.country, ageBand: input.ageBand, termsVersion: input.termsVersion, privacyVersion: input.privacyVersion, guardianGrantId: guardianGrantId ?? null }) } });
  return receipt;
  };
}
export async function saveAccountConsent(tx: Prisma.TransactionClient, userId: string, email: string, input: ConsentInput) {
  return (await prepareAccountConsent(tx, email, input))(userId);
}

export async function acceptAccountConsent(user: AuthUser, input: ConsentInput) {
  if (user.role !== "STUDENT") throw new AuthorizationApiError();
  assertAccountPolicyReady();
  return prisma.$transaction(async tx => {
    const current = await tx.accountConsent.findUnique({ where: { userId: user.id } });
    // A claimed age change cannot remove an existing child's safeguards.
    if (current && current.ageBand !== "18_PLUS" && input.ageBand === "18_PLUS") throw new ValidationApiError("Contact support to verify a change to your age group");
    await saveAccountConsent(tx, user.id, user.email, input);
    return { accepted: true };
  });
}
export async function withdrawAccountConsent(user: AuthUser) {
  if (user.role !== "STUDENT") throw new AuthorizationApiError();
  return prisma.$transaction(async tx => {
    await tx.accountConsent.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "ACCOUNT_CONSENT_WITHDRAWN", entity: "User", entityId: user.id } });
    return { withdrawn: true };
  });
}

export const issueGuardianSchema = z.object({
  guardianId: z.string().min(1).max(100), childEmail: z.email(), country: z.enum(["IN", "AE"]),
  verificationReference: z.string().trim().min(8).max(200), guardianIdentityAndAuthorityVerified: z.literal(true), guardianConsentRecorded: z.literal(true),
}).strict();
export async function issueGuardianApproval(actor: AuthUser, input: z.infer<typeof issueGuardianSchema>) {
  if (actor.role !== "PLATFORM_ADMIN") throw new AuthorizationApiError();
  assertAccountPolicyReady();
  if (process.env.ACCOUNT_GUARDIAN_VERIFICATION_APPROVED !== "true") throw new ApiError(503, "ACCOUNT_UNAVAILABLE", "Guardian verification is temporarily unavailable");
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.$transaction(async tx => {
    if (!await tx.user.findFirst({ where: { id: input.guardianId, role: "PARENT", status: "ACTIVE" } })) throw new ValidationApiError("Verified guardian account is unavailable");
    const grant = await tx.guardianRegistrationGrant.create({ data: { tokenHash: hashSessionToken(token), childEmailHash: childEmailHash(input.childEmail),
      country: input.country, policyVersion: ACCOUNT_POLICY_VERSION, guardianId: input.guardianId, verifiedById: actor.id,
      verificationReference: input.verificationReference, expiresAt } });
    await tx.auditEvent.create({ data: { actorId: actor.id, action: "GUARDIAN_REGISTRATION_VERIFIED", entity: "GuardianRegistrationGrant", entityId: grant.id } });
  });
  return { approval: token, expiresAt };
}
export async function revokeGuardianApproval(user: AuthUser, grantId: string) {
  if (!["PARENT", "PLATFORM_ADMIN"].includes(user.role)) throw new AuthorizationApiError();
  return prisma.$transaction(async tx => {
    const grant = await tx.guardianRegistrationGrant.findFirst({ where: { id: grantId, ...(user.role === "PARENT" ? { guardianId: user.id } : {}) } });
    if (!grant) throw new AuthorizationApiError();
    await tx.guardianRegistrationGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    const receipt = await tx.accountConsent.findUnique({ where: { guardianGrantId: grant.id } });
    if (receipt) {
      await tx.accountConsent.update({ where: { userId: receipt.userId }, data: { revokedAt: new Date() } });
      await tx.session.updateMany({ where: { userId: receipt.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await tx.auditEvent.create({ data: { actorId: user.id, action: "GUARDIAN_REGISTRATION_REVOKED", entity: "GuardianRegistrationGrant", entityId: grant.id } });
    return { revoked: true };
  });
}

export const verifyAdultSchema = z.object({ studentId: z.string().min(1).max(100), verificationReference: z.string().trim().min(8).max(200), adultIdentityVerified: z.literal(true) }).strict();
export async function verifyAdultAccount(actor: AuthUser, input: z.infer<typeof verifyAdultSchema>) {
  if (actor.role !== "PLATFORM_ADMIN") throw new AuthorizationApiError();
  assertAccountPolicyReady();
  if (process.env.ACCOUNT_GUARDIAN_VERIFICATION_APPROVED !== "true") throw new ApiError(503, "ACCOUNT_UNAVAILABLE", "Account verification is temporarily unavailable");
  return prisma.$transaction(async tx => {
    if (!await tx.user.findFirst({ where: { id: input.studentId, role: "STUDENT", status: "ACTIVE" } })) throw new ValidationApiError("Student account is unavailable");
    const current = await tx.accountConsent.findUnique({ where: { userId: input.studentId } });
    if (!current) throw new ValidationApiError("Account consent record is unavailable");
    await tx.accountConsent.update({ where: { userId: input.studentId }, data: { ageBand: "18_PLUS", guardianGrantId: null, revokedAt: new Date() } });
    await tx.session.updateMany({ where: { userId: input.studentId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: actor.id, action: "ACCOUNT_ADULTHOOD_VERIFIED", entity: "User", entityId: input.studentId,
      detail: JSON.stringify({ verificationReference: input.verificationReference, previousAgeBand: current.ageBand, previousGuardianGrantId: current.guardianGrantId }) } });
    return { verified: true, requiresRenewedConsent: true };
  });
}
