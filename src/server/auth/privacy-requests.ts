import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthUser } from "./session";
import { atomic, type Tx } from "@/server/commerce/transaction";
import { freshActor } from "@/server/portal/authorization";
import { AuthorizationApiError, ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
import { adultConsentWhere } from "./sharing";

export const privacyRequestSchema = z.object({ requestKey: z.uuid(), kind: z.enum(["ACCESS", "CORRECT", "DELETE", "ACCOUNT_SUPPORT"]),
  subjectId: z.string().min(1).max(100).optional(), message: z.string().trim().min(10).max(1000) }).strict();
export const privacyDecisionSchema = z.object({ id: z.string().min(1).max(100), expectedVersion: z.number().int().min(0),
  status: z.enum(["IN_REVIEW", "AWAITING_USER", "RESOLVED", "REJECTED"]), response: z.string().trim().min(10).max(1000),
  completionReference: z.string().trim().min(8).max(200).optional(), processingVerified: z.boolean().optional() }).strict().superRefine((value, ctx) => {
    if (["RESOLVED", "REJECTED"].includes(value.status) && (!value.completionReference || value.processingVerified !== true)) {
      ctx.addIssue({ code: "custom", message: "Recorded verification and processing evidence are required to close a request" });
    }
  });
export const privacyReplySchema = z.object({ id: z.string().min(1).max(100), expectedVersion: z.number().int().min(0),
  requestKey: z.uuid(), message: z.string().trim().min(10).max(1000) }).strict();
const select = { id: true, subjectId: true, kind: true, message: true, followUp: true, status: true, response: true, version: true, createdAt: true, updatedAt: true };
const pageSchema = z.coerce.number().int().min(1).max(1000);
function privacyProcessingEnabled() { return process.env.ACCOUNT_POLICY_REVIEWED === "true" && process.env.ACCOUNT_PRIVACY_PROCESSING_APPROVED === "true"; }
async function authorizeSubject(user: AuthUser, subjectId: string, tx: Tx) {
  const actor = await freshActor(user, tx, ["STUDENT", "PARENT"]);
  if (subjectId !== actor.id) {
    if (actor.role !== "PARENT") throw new AuthorizationApiError();
    const grant = await tx.guardianRegistrationGrant.findFirst({ where: { guardianId: actor.id, revokedAt: null, usedAt: { not: null },
      policyVersion: ACCOUNT_POLICY_VERSION, receipt: { is: { userId: subjectId, user: { role: "STUDENT" } } }, guardian: { role: "PARENT", status: "ACTIVE", accountConsent: { is: adultConsentWhere() } } }, select: { id: true } });
    if (!grant) throw new AuthorizationApiError("Verified guardian authority is required");
  }
  return actor;
}
export async function listPrivacyRequests(user: AuthUser, rawPage: unknown = 1) {
  const page = pageSchema.parse(rawPage);
  await freshActor(user, prisma, ["STUDENT", "PARENT"]);
  const rows = await prisma.accountPrivacyRequest.findMany({ where: { requesterId: user.id }, select, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 26 });
  return { records: rows.slice(0, 25), page, hasNext: rows.length > 25 };
}
export async function createPrivacyRequest(user: AuthUser, raw: z.infer<typeof privacyRequestSchema>) {
  const input = privacyRequestSchema.parse(raw);
  return atomic(async tx => {
    const subjectId = input.subjectId ?? user.id;
    const actor = await authorizeSubject(user, subjectId, tx);
    const previous = await tx.accountPrivacyRequest.findUnique({ where: { requesterId_requestKey: { requesterId: actor.id, requestKey: input.requestKey } } });
    if (previous) {
      if (previous.subjectId !== subjectId || previous.kind !== input.kind || previous.message !== input.message) throw new ConflictApiError("This request identifier was already used");
      return tx.accountPrivacyRequest.findUnique({ where: { id: previous.id }, select });
    }
    if (await tx.accountPrivacyRequest.count({ where: { requesterId: actor.id, status: { in: ["OPEN", "IN_REVIEW", "AWAITING_USER"] } } }) >= 5) {
      throw new ValidationApiError("Please follow up on your existing requests before opening another");
    }
    const record = await tx.accountPrivacyRequest.create({ data: { requesterId: actor.id, subjectId, requestKey: input.requestKey, kind: input.kind, message: input.message }, select });
    await tx.auditEvent.create({ data: { actorId: actor.id, entity: "ACCOUNT_PRIVACY", entityId: record.id, action: "PRIVACY_REQUEST_OPENED", detail: JSON.stringify({ kind: input.kind }) } });
    return record;
  });
}
export async function listPrivacyQueue(user: AuthUser, rawPage: unknown = 1) {
  const page = pageSchema.parse(rawPage);
  await freshActor(user, prisma, ["PLATFORM_ADMIN"]);
  const rows = await prisma.accountPrivacyRequest.findMany({ select: { ...select, requesterId: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 26 });
  return { records: rows.slice(0, 25), page, hasNext: rows.length > 25, processingEnabled: privacyProcessingEnabled() };
}
export async function replyPrivacyRequest(user: AuthUser, raw: z.infer<typeof privacyReplySchema>) {
  const input = privacyReplySchema.parse(raw);
  return atomic(async tx => {
    const row = await tx.accountPrivacyRequest.findFirst({ where: { id: input.id, requesterId: user.id } });
    if (!row) throw new AuthorizationApiError();
    await authorizeSubject(user, row.subjectId, tx);
    if (row.followUpKey === input.requestKey) {
      if (row.followUp !== input.message) throw new ConflictApiError("This request identifier was already used");
      return tx.accountPrivacyRequest.findUnique({ where: { id: row.id }, select });
    }
    if (row.version !== input.expectedVersion) throw new ConflictApiError("This request changed. Refresh before replying.");
    if (["RESOLVED", "REJECTED"].includes(row.status)) throw new ValidationApiError("This request is closed");
    if (await tx.auditEvent.count({ where: { actorId: user.id, entity: "ACCOUNT_PRIVACY", action: "PRIVACY_REQUEST_FOLLOW_UP", createdAt: { gte: new Date(Date.now() - 60000) } } }) >= 5) {
      throw new ValidationApiError("Please wait before sending another follow-up");
    }
    const changed = await tx.accountPrivacyRequest.updateMany({ where: { id: row.id, requesterId: user.id, version: input.expectedVersion, status: row.status },
      data: { followUp: input.message, followUpKey: input.requestKey, status: "OPEN", completionReference: null, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictApiError("This request changed. Refresh before replying.");
    await tx.auditEvent.create({ data: { actorId: user.id, entity: "ACCOUNT_PRIVACY", entityId: row.id, action: "PRIVACY_REQUEST_FOLLOW_UP" } });
    return tx.accountPrivacyRequest.findUnique({ where: { id: row.id }, select });
  });
}
export async function decidePrivacyRequest(user: AuthUser, raw: z.infer<typeof privacyDecisionSchema>) {
  const input = privacyDecisionSchema.parse(raw);
  return atomic(async tx => {
    await freshActor(user, tx, ["PLATFORM_ADMIN"]);
    const row = await tx.accountPrivacyRequest.findUnique({ where: { id: input.id } });
    if (!row) throw new ValidationApiError("Request is unavailable");
    const reference = input.completionReference ?? null;
    if (row.version === input.expectedVersion + 1 && row.status === input.status && row.response === input.response && row.completionReference === reference) {
      return tx.accountPrivacyRequest.findUnique({ where: { id: row.id }, select });
    }
    if (row.version !== input.expectedVersion) throw new ConflictApiError("This request changed. Refresh before responding.");
    if (["RESOLVED", "REJECTED"].includes(input.status) && row.kind !== "ACCOUNT_SUPPORT" && !privacyProcessingEnabled()) {
      throw new ValidationApiError("Privacy processing requires approved policies and operating procedures");
    }
    const allowed: Record<string, string[]> = { OPEN: ["IN_REVIEW", "AWAITING_USER", "REJECTED"], IN_REVIEW: ["AWAITING_USER", "RESOLVED", "REJECTED"], AWAITING_USER: ["IN_REVIEW", "RESOLVED", "REJECTED"] };
    if (!allowed[row.status]?.includes(input.status)) throw new ValidationApiError("This request transition is not allowed");
    const changed = await tx.accountPrivacyRequest.updateMany({ where: { id: row.id, version: input.expectedVersion, status: row.status },
      data: { status: input.status, response: input.response, completionReference: reference, reviewerId: user.id, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictApiError("This request changed. Refresh before responding.");
    await tx.auditEvent.create({ data: { actorId: user.id, entity: "ACCOUNT_PRIVACY", entityId: row.id, action: "PRIVACY_REQUEST_UPDATED", detail: JSON.stringify({ status: input.status }) } });
    return tx.accountPrivacyRequest.findUnique({ where: { id: row.id }, select });
  });
}
