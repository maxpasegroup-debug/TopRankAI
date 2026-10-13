import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { prisma } from "@/server/db";
const messages = { PILOT_ACCESS_REVOKED: "Your invited pilot access has been withdrawn.", PILOT_ACCESS_GRANTED: "Your invited pilot access has been updated.", SUPPORT_UPDATED: "Your support request has an update.", ACHIEVEMENT_EARNED: "A new achievement has been earned from your saved activity.", COMPETITION_VERIFIED: "Competition results have been verified or updated.", COMPETITION_CANCELLED: "A competition you joined was cancelled." } as const;
export async function inAppNotice(tx: Prisma.TransactionClient, userId: string, eventKey: string, template: keyof typeof messages) {
  await tx.commerceNotification.upsert({ where: { userId_eventKey_channel: { userId, eventKey, channel: "IN_APP" } },
    create: { userId, eventKey, channel: "IN_APP", template, message: messages[template], status: "AVAILABLE" }, update: {} });
}
export const inboxQuerySchema = z.object({ page: z.coerce.number().int().min(1).max(100).default(1), unread: z.enum(["true", "false"]).default("false") });
export const inboxMutationSchema = z.union([z.object({ action: z.literal("READ"), id: z.string().min(1).max(100) }).strict(), z.object({ action: z.literal("READ_ALL") }).strict()]);
function destination(template: string) { return template === "SUPPORT_UPDATED" ? "/get-help" : template === "ACHIEVEMENT_EARNED" ? "/achievements" : template.startsWith("COMPETITION_") ? "/compete" : template === "PORTAL_UPDATED" ? "/consent" : "/packages"; }
export async function getInbox(user: AuthUser, raw: unknown) {
  assertStudent(user); const query = inboxQuerySchema.parse(raw);
  const owned = { userId: user.id, channel: "IN_APP", status: "AVAILABLE" };
  const [records, unread] = await Promise.all([
    prisma.commerceNotification.findMany({ where: { ...owned, ...(query.unread === "true" ? { readAt: null } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * 25, take: 26, select: { id: true, message: true, template: true, readAt: true, createdAt: true } }),
    prisma.commerceNotification.count({ where: { ...owned, readAt: null } }),
  ]);
  return { page: query.page, unread, hasNext: records.length > 25, entries: records.slice(0, 25).map(r => ({ id: r.id, message: r.message, read: Boolean(r.readAt), at: r.createdAt.toISOString(), href: destination(r.template) })) };
}
export async function readInbox(user: AuthUser, raw: z.infer<typeof inboxMutationSchema>) {
  assertStudent(user); const input = inboxMutationSchema.parse(raw), now = new Date();
  await prisma.commerceNotification.updateMany({ where: { userId: user.id, channel: "IN_APP", status: "AVAILABLE", readAt: null,
    ...(input.action === "READ" ? { id: input.id } : { createdAt: { lte: now } }) }, data: { readAt: now } });
  return { saved: true };
}
