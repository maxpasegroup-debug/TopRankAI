import { z } from "zod";
import { accountConsentSchema } from "./validation";
import { needsGuardian } from "@/shared/account-policy";

export const mobileSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international mobile number, for example +919876543210");
export const pinSchema = z.string().regex(/^\d{6}$/, "Enter exactly six digits")
  .refine(value => !/^(\d)\1{5}$/.test(value) && !["123456", "654321"].includes(value), "Choose a less predictable PIN");
export const registrationSchema = z.object({ name: z.string().trim().min(2).max(120), phone: mobileSchema,
  email: z.email().transform(value => value.toLowerCase()), role: z.literal("STUDENT").default("STUDENT"),
}).extend(accountConsentSchema.shape).strict().superRefine((value, ctx) => {
  if (needsGuardian(value.ageBand) && !value.guardianApproval) ctx.addIssue({ code: "custom", message: "Verified guardian authorization is required", path: ["guardianApproval"] });
});
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const newPin = { pin: pinSchema, confirmPin: z.string().regex(/^\d{6}$/) };
export const pinRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("requestSignup"), registration: registrationSchema }).strict(),
  z.object({ action: z.literal("requestReset"), email: z.email().transform(value => value.toLowerCase()) }).strict(),
  z.object({ action: z.literal("verify"), challenge: token, code: z.string().regex(/^\d{6}$/) }).strict(),
  z.object({ action: z.literal("signup"), challenge: token, proof: token, registration: registrationSchema, ...newPin }).strict(),
  z.object({ action: z.literal("reset"), challenge: token, proof: token, ...newPin }).strict(),
  z.object({ action: z.literal("login"), phone: mobileSchema, pin: z.string().regex(/^\d{6}$/) }).strict(),
]).superRefine((value, ctx) => {
  if ((value.action === "signup" || value.action === "reset") && value.pin !== value.confirmPin) ctx.addIssue({ code: "custom", message: "PINs do not match", path: ["confirmPin"] });
});
