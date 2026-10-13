import { prisma } from "@/server/db";
import { getCurrentUser, type AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { AuthorizationApiError } from "@/server/api/errors";
import type { Tx } from "./transaction";
export async function requireFeature(user: AuthUser, code: string, db: Tx = prisma, now = new Date()) {
 assertStudent(user);
 const entitlement = await db.entitlement.findFirst({ where: { userId: user.id, featureCode: code, status: "ACTIVE",
   startsAt: { lte: now }, endsAt: { gt: now }, OR: [{ source: { in: ["ADMIN", "TRIAL"] }, orderId: null },
     { source: "PURCHASE", order: { userId: user.id, status: "CAPTURED", capturedAt: { not: null } } }] }, select: { id: true } });
 if (!entitlement) throw new AuthorizationApiError("An active entitlement is required");
}
export async function requireResourceAccess(kind: "MOCK" | "LESSON", resourceId: string, user?: AuthUser, db: Tx = prisma) {
 const gate = await db.commerceGate.findUnique({ where: { kind_resourceId: { kind, resourceId } } });
 if (!gate) return; // Unbound resources retain their existing free-access contract.
 const identity = user ?? await getCurrentUser();
 if (!identity) throw new AuthorizationApiError();
 await requireFeature(identity, gate.featureCode, db);
}
