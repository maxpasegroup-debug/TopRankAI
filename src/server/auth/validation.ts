import { z } from "zod";
import { ACCOUNT_POLICY_VERSION, accountAgeBands, accountCountries, needsGuardian } from "@/shared/account-policy";

export const newPasswordSchema = z.string().min(8).max(72)
  .refine(value => new TextEncoder().encode(value).length <= 72, "Password exceeds the supported byte length");
export const accountConsentSchema = z.object({
  country: z.enum(accountCountries), ageBand: z.enum(accountAgeBands),
  termsAccepted: z.literal(true), privacyAccepted: z.literal(true),
  termsVersion: z.literal(ACCOUNT_POLICY_VERSION), privacyVersion: z.literal(ACCOUNT_POLICY_VERSION),
  guardianApproval: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).strict();

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  password: newPasswordSchema,
  // Public registration defaults to student and rejects all other roles.
  role: z.literal("STUDENT").default("STUDENT"),
  targetExam: z.string().trim().max(32).optional(),
}).extend(accountConsentSchema.shape).strict().superRefine((value, context) => {
  if (needsGuardian(value.ageBand) && !value.guardianApproval) context.addIssue({ code: "custom", path: ["guardianApproval"], message: "Verified guardian authorization is required" });
});

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const recoverySchema = z.object({ email: z.email().transform(value => value.toLowerCase()) }).strict();
export const resetPasswordSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: newPasswordSchema }).strict();
