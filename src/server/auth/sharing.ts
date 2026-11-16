import type { Prisma } from "@/generated/prisma/client";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";

export function adultConsentWhere(): Prisma.AccountConsentWhereInput {
  return { ageBand: "18_PLUS", revokedAt: null, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION };
}

export function currentConsentWhere(): Prisma.AccountConsentWhereInput {
  return {
    revokedAt: null,
    termsVersion: ACCOUNT_POLICY_VERSION,
    privacyVersion: ACCOUNT_POLICY_VERSION,
    OR: [
      { ageBand: "18_PLUS" },
      { ageBand: { in: ["UNDER_13", "13_TO_17"] }, guardianGrant: { is: {
        revokedAt: null,
        usedAt: { not: null },
        policyVersion: ACCOUNT_POLICY_VERSION,
        guardian: { is: { status: "ACTIVE", role: "PARENT", accountConsent: { is: adultConsentWhere() } } },
      } } },
    ],
  };
}

export async function withdrawUserAccess(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
  await tx.accountConsent.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.passwordReset.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now, deliveryPayload: null } });
  await tx.emailOtpChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
}
