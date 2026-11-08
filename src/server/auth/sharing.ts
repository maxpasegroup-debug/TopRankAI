import type { Prisma } from "@/generated/prisma/client";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
import { AuthorizationApiError } from "@/server/api/errors";

export function adultConsentWhere(): Prisma.AccountConsentWhereInput {
  return { ageBand: "18_PLUS", revokedAt: null, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION };
}
export function currentConsentWhere(): Prisma.AccountConsentWhereInput {
  return { revokedAt: null, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION,
    OR: [{ ageBand: "18_PLUS" }, { ageBand: { in: ["UNDER_13", "13_TO_17"] }, guardianGrant: { is: {
      revokedAt: null, usedAt: { not: null }, policyVersion: ACCOUNT_POLICY_VERSION,
      guardian: { is: { status: "ACTIVE", role: "PARENT", accountConsent: { is: adultConsentWhere() } } },
    } } }] };
}
export function sharingStudentWhere(): Prisma.UserWhereInput {
  return { status: "ACTIVE", role: "STUDENT", accountConsent: { is: currentConsentWhere() } };
}
export async function requireSharingConsent(db: Pick<Prisma.TransactionClient, "user">, userId: string) {
  if (!await db.user.findFirst({ where: { id: userId, ...sharingStudentWhere() }, select: { id: true } })) {
    throw new AuthorizationApiError("Current account authorization is required");
  }
}
async function withdrawScope(tx: Prisma.TransactionClient, scope: { userId: string } | { user: { is: Prisma.UserWhereInput } }, now: Date) {
  await tx.accountConsent.updateMany({ where: { ...scope, revokedAt: null }, data: { revokedAt: now } });
  await tx.session.updateMany({ where: { ...scope, revokedAt: null }, data: { revokedAt: now } });
  await tx.passwordReset.updateMany({ where: { ...scope, consumedAt: null }, data: { consumedAt: now, deliveryPayload: null } });
  await tx.emailOtpChallenge.updateMany({ where: { ...scope, consumedAt: null }, data: { consumedAt: now } });
  await tx.earnedAchievement.updateMany({ where: { ...scope, shareHash: { not: null } }, data: { shareHash: null, version: { increment: 1 } } });
  await tx.competitionEntry.updateMany({ where: { ...scope, visible: true }, data: { visible: false } });
  const student = "userId" in scope ? { studentUserId: scope.userId } : { student: scope.user };
  const enrollment = "userId" in scope ? { studentId: scope.userId } : { student: scope.user };
  await tx.studentParentRelationship.updateMany({ where: { ...student, status: { in: ["PENDING", "ACTIVE"] } },
    data: { status: "REVOKED", studentConsentAt: null, parentAcceptedAt: null, version: { increment: 1 } } });
  await tx.schoolEnrollment.updateMany({ where: { ...enrollment, status: { in: ["PENDING", "ACTIVE"] } },
    data: { status: "REVOKED", studentConsentAt: null, version: { increment: 1 } } });
}
export async function withdrawStudentAccess(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
  await withdrawScope(tx, { userId }, now);
}
export async function withdrawGuardianDependents(tx: Prisma.TransactionClient, guardianId: string, now: Date) {
  await withdrawScope(tx, { user: { is: { role: "STUDENT", accountConsent: { is: { guardianGrant: { is: { guardianId } } } } } } }, now);
  await tx.guardianRegistrationGrant.updateMany({ where: { guardianId, revokedAt: null }, data: { revokedAt: now } });
  await tx.studentParentRelationship.updateMany({ where: { parentUserId: guardianId, status: { in: ["PENDING", "ACTIVE"] } },
    data: { status: "REVOKED", parentAcceptedAt: null, studentConsentAt: null, version: { increment: 1 } } });
}
