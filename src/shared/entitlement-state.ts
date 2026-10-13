type Grant = { userId?: string; status: string; startsAt: Date; endsAt: Date; source: string; orderId?: string | null; order?: { userId: string; status: string; capturedAt: Date | null } | null };
export function entitlementState(grant: Grant, now: Date) {
  if (grant.status !== "ACTIVE") return grant.status;
  if (grant.endsAt <= now) return "EXPIRED";
  if (grant.startsAt > now) return "SCHEDULED";
  if (grant.source === "PURCHASE" && (!grant.order?.capturedAt || grant.order.status !== "CAPTURED" || grant.order.userId !== grant.userId)) return "BLOCKED";
  if (!["PURCHASE", "ADMIN", "TRIAL"].includes(grant.source) || grant.source !== "PURCHASE" && grant.orderId) return "BLOCKED";
  return "ACTIVE";
}
