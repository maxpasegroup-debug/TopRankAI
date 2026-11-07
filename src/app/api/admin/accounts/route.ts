import { z } from "zod";
import { adminMutation } from "@/server/api/admin-handler";
import { issueGuardianApproval, issueGuardianSchema, verifyAdultAccount, verifyAdultSchema } from "@/server/auth/account-consent";
import { clearExpiredRecoveryPayloads, deliverPasswordRecoveries } from "@/server/auth/recovery";

const schema = z.discriminatedUnion("action", [issueGuardianSchema.extend({ action: z.literal("guardianApproval") }), verifyAdultSchema.extend({ action: z.literal("verifyAdult") }), z.object({ action: z.literal("deliverRecovery"), limit: z.number().int().min(1).max(10) }).strict(), z.object({ action: z.literal("clearRecoveryPayloads"), limit: z.number().int().min(1).max(100) }).strict()]);
export const POST = adminMutation(schema, (user, input) => {
  if (input.action === "guardianApproval") return issueGuardianApproval(user, issueGuardianSchema.parse({ guardianId: input.guardianId, childEmail: input.childEmail, country: input.country, verificationReference: input.verificationReference, guardianIdentityAndAuthorityVerified: input.guardianIdentityAndAuthorityVerified, guardianConsentRecorded: input.guardianConsentRecorded }));
  if (input.action === "verifyAdult") return verifyAdultAccount(user, verifyAdultSchema.parse({ studentId: input.studentId, verificationReference: input.verificationReference, adultIdentityVerified: input.adultIdentityVerified }));
  if (input.action === "clearRecoveryPayloads") return clearExpiredRecoveryPayloads(input.limit);
  return deliverPasswordRecoveries(input.limit);
});
