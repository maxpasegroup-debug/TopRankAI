import { z } from "zod";
export const id = z.string().min(1).max(128);
export const money = z.number().int().min(1).max(100000000);
export const feature = z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/).refine((s) => !/^(AI|CREDIT|WALLET|EARNING)|_(CREDIT|WALLET|EARNING)/.test(s), "Accounting-backed features are unavailable");
export const reason = z.string().trim().min(8).max(500);
const date = z.union([z.iso.datetime(), z.date()]).transform((s) => new Date(s));
export const packageSchema = z.object({ code: feature, revision: z.number().int().min(1).max(10000), title: z.string().trim().min(2).max(100),
 description: z.string().trim().max(1000), amountMinor: z.number().int().min(0).max(100000000), currency: z.literal("INR"), interval: z.enum(["ONCE", "MONTH", "YEAR"]),
 durationDays: z.number().int().min(1).max(3660), features: z.array(feature).min(1).max(30).refine((a) => new Set(a).size === a.length),
 availableFrom: date, availableUntil: date }).strict()
 .refine((p) => p.availableUntil > p.availableFrom, "Availability window is invalid")
 .refine((p) => p.amountMinor > 0 || p.interval === "ONCE", "Free packages require fixed one-time access");
export const pilotGrantSchema = z.object({ action: z.literal("pilotGrant"), userId: id, packageId: id, requestKey: z.uuid(), startsAt: date, reason }).strict();
export const studentCommerceSchema = z.discriminatedUnion("action", [
 z.object({ action: z.literal("purchase"), packageId: id, requestKey: z.uuid() }).strict(),
 z.object({ action: z.literal("cancel"), orderId: id }).strict(),
 z.object({ action: z.literal("verify"), orderId: id, paymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/) }).strict(),
 z.object({ action: z.literal("refund"), orderId: id, requestKey: z.uuid(), amountMinor: money, reason }).strict(),
 z.object({ action: z.literal("read"), id }).strict(),
 z.object({ action: z.literal("preferences"), email: z.boolean(), whatsapp: z.boolean() }).strict(),
]);
export const adminCommerceSchema = z.discriminatedUnion("action", [
 pilotGrantSchema,
 z.object({ action: z.literal("feature"), code: feature, title: z.string().trim().min(2).max(100) }).strict(),
 z.object({ action: z.literal("package"), package: packageSchema }).strict(),
 z.object({ action: z.literal("publication"), id, status: z.enum(["PUBLISHED", "RETIRED"]), reason }).strict(),
 z.object({ action: z.literal("gate"), kind: z.enum(["MOCK", "LESSON"]), resourceId: id, featureCode: feature.nullable(), reason }).strict(),
 z.object({ action: z.literal("grant"), userId: id, featureCode: feature, source: z.enum(["ADMIN", "TRIAL"]), requestKey: z.uuid(),
   startsAt: date, endsAt: date, reason }).strict().refine((x) => x.endsAt > x.startsAt),
 z.object({ action: z.literal("revoke"), id, reason }).strict(),
 z.object({ action: z.literal("refundReview"), id, status: z.enum(["APPROVED", "REJECTED"]), reason }).strict(),
 z.object({ action: z.literal("refundSubmit"), id }).strict(),
 z.object({ action: z.literal("refundRefresh"), id }).strict(),
 z.object({ action: z.literal("eventRetry"), id }).strict(),
 z.object({ action: z.literal("dispatch") }).strict(),
]);
