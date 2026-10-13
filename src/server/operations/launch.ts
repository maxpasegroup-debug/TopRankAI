import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
import { assertPlatformAdmin } from "@/server/operations/service";
import { prisma } from "@/server/db";
import { entitlementState } from "@/shared/entitlement-state";
const page = z.coerce.number().int().min(1).max(1000).default(1);
export const accessQuerySchema = z.object({ page, userId: z.string().trim().min(1).max(128).optional(), status: z.enum(["ALL", "CURRENT", "SCHEDULED", "EXPIRED", "REVOKED"]).default("ALL") }).strict();
export const auditQuerySchema = z.object({ page, entity: z.string().trim().min(1).max(80).regex(/^[A-Za-z_]+$/).optional(), action: z.string().trim().min(1).max(80).regex(/^[A-Z_]+$/).optional() }).strict();
export function launchControls(env: Readonly<Record<string, string | undefined>> = process.env) {
  const flags = ["AUTH_RATE_LIMIT_ACTIVATED", "AUTH_RATE_LIMIT_LIVE_VERIFIED", "AUTH_TRUSTED_PROXY_VERIFIED", "ACCOUNT_POLICY_REVIEWED", "ACCOUNT_GUARDIAN_VERIFICATION_APPROVED", "AUTH_RECOVERY_DELIVERY_VERIFIED"];
  return { offering: "FREE_INVITED_PILOT", payments: "DISABLED", externalMessaging: "DISABLED", liveAI: "DISABLED", approvalFlags: flags.map(name => ({ name, set: env[name] === "true" })),
    externalEvidence: ["Disposable database migration and concurrency verification", "Authenticated browser acceptance", "Reviewed licensed content", "Guardian and country policy approval", "Monitoring and alert delivery drill", "Encrypted backup and isolated restore drill"].map(label => ({ label, status: "NOT_VERIFIED_BY_APPLICATION" })) };
}
export async function launchOverview(user: AuthUser) {
  assertPlatformAdmin(user); const now = new Date(), stale = new Date(now.getTime() - 48 * 3600000);
  const [openSupport, staleSupport, paymentReview, eventRetry, refundReview, deliveryProblems, expiredGrants, freePackages] = await Promise.all([
    prisma.helpRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.helpRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, updatedAt: { lt: stale } } }),
    prisma.commerceOrder.count({ where: { checkoutState: { in: ["CREATING", "REVIEW"] }, status: "PENDING" } }),
    prisma.commerceEvent.count({ where: { status: "RETRY" } }),
    prisma.commerceRefund.count({ where: { status: { in: ["REQUESTED", "APPROVED", "SUBMITTING", "PENDING"] } } }),
    prisma.commerceNotification.count({ where: { channel: { not: "IN_APP" }, status: { in: ["RETRY", "FAILED", "BLOCKED"] } } }),
    prisma.entitlement.count({ where: { status: "ACTIVE", endsAt: { lte: now } } }),
    prisma.commercePackage.count({ where: { status: "PUBLISHED", amountMinor: 0, availableFrom: { lte: now }, availableUntil: { gt: now } } }),
  ]);
  return { asOf: now.toISOString(), counts: { openSupport, staleSupport, paymentReview, eventRetry, refundReview, deliveryProblems, expiredGrants, freePackages }, controls: launchControls() };
}
export async function listEntitlements(user: AuthUser, raw: unknown) {
  assertPlatformAdmin(user); const input = accessQuerySchema.parse(raw), now = new Date();
  // CURRENT filters the lifecycle window, not permission. Blocked purchase rows
  // remain visible for operators; requireFeature is the access authority.
  const effective: Prisma.EntitlementWhereInput = input.status === "CURRENT" ? { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } }
    : input.status === "SCHEDULED" ? { status: "ACTIVE", startsAt: { gt: now }, endsAt: { gt: now } }
    : input.status === "EXPIRED" ? { status: "ACTIVE", endsAt: { lte: now } }
    : input.status === "REVOKED" ? { status: "REVOKED" } : {};
  const records = await prisma.entitlement.findMany({ where: { ...(input.userId ? { userId: input.userId } : {}), ...effective }, orderBy: [{ startsAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * 25, take: 26,
    select: { id: true, userId: true, featureCode: true, source: true, status: true, startsAt: true, endsAt: true, reason: true, orderId: true, order: { select: { userId: true, status: true, capturedAt: true } } } });
  return { page: input.page, hasNext: records.length > 25, asOf: now.toISOString(), entries: records.slice(0, 25).map(grant => ({ id: grant.id, userId: grant.userId, featureCode: grant.featureCode, source: grant.source, status: entitlementState(grant, now), startsAt: grant.startsAt.toISOString(), endsAt: grant.endsAt.toISOString(), reason: grant.reason })) };
}
export async function listOperationalAudit(user: AuthUser, raw: unknown) {
  assertPlatformAdmin(user); const input = auditQuerySchema.parse(raw);
  const records = await prisma.auditEvent.findMany({ where: { ...(input.entity ? { entity: input.entity } : {}), ...(input.action ? { action: input.action } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * 25, take: 26,
    select: { id: true, entity: true, entityId: true, action: true, createdAt: true } });
  return { page: input.page, hasNext: records.length > 25, entries: records.slice(0, 25).map(record => ({ id: record.id, entity: record.entity, entityId: record.entityId, action: record.action, at: record.createdAt.toISOString() })) };
}
