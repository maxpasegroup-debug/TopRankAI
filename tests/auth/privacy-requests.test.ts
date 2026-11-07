import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { AuthUser } from "@/server/auth/session";
const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() });
  return { $transaction: vi.fn(), user: model(), guardianRegistrationGrant: model(), accountPrivacyRequest: model(), auditEvent: model() };
});
vi.mock("@/server/db", () => ({ prisma: db }));
import { createPrivacyRequest, decidePrivacyRequest, listPrivacyQueue, listPrivacyRequests, privacyDecisionSchema, privacyReplySchema, privacyRequestSchema, replyPrivacyRequest } from "@/server/auth/privacy-requests";
const student: AuthUser = { id: "student", role: "STUDENT", name: "Fixture", email: "synthetic@example.invalid", requiresLegalConsent: true };
const parent: AuthUser = { ...student, id: "parent", role: "PARENT" };
const admin: AuthUser = { ...student, id: "admin", role: "PLATFORM_ADMIN" };
const input = { requestKey: "8664dc14-a97f-4e63-9747-0a76e597a077", kind: "DELETE" as const, message: "Please review deletion of my account records." };
const row = () => ({ id: "case", requesterId: student.id, subjectId: student.id, kind: input.kind, message: input.message, requestKey: input.requestKey,
  followUp: null as string | null, followUpKey: null as string | null, status: "IN_REVIEW", version: 0, response: null as string | null, completionReference: null as string | null, createdAt: new Date(), updatedAt: new Date() });
const decision = { id: "case", expectedVersion: 0, status: "RESOLVED" as const, response: "Manual processing checked against the restricted case.", completionReference: "restricted-evidence-001", processingVerified: true };
function actor(user: AuthUser) { db.user.findUnique.mockResolvedValue({ ...user, status: "ACTIVE" }); }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("ACCOUNT_POLICY_REVIEWED", "false"); vi.stubEnv("ACCOUNT_PRIVACY_PROCESSING_APPROVED", "false");
  db.$transaction.mockImplementation(work => work(db)); actor(student); db.accountPrivacyRequest.count.mockResolvedValue(0);
  db.accountPrivacyRequest.findUnique.mockResolvedValue(null); db.accountPrivacyRequest.findMany.mockResolvedValue([]);
  db.accountPrivacyRequest.create.mockResolvedValue({ ...row(), status: "OPEN" }); db.accountPrivacyRequest.updateMany.mockResolvedValue({ count: 1 });
  db.guardianRegistrationGrant.findFirst.mockResolvedValue(null); db.auditEvent.count.mockResolvedValue(0);
});
afterEach(() => vi.unstubAllEnvs());
describe("private account-rights intake (mocked persistence)", () => {
  it.each(["status", "reviewerId", "requesterId", "userId", "role", "completionReference"])("rejects forged %s", field => {
    expect(privacyRequestSchema.safeParse({ ...input, [field]: "PLATFORM_ADMIN" }).success).toBe(false);
  });
  it.each(["ACCESS", "CORRECT", "DELETE", "ACCOUNT_SUPPORT"] as const)("accepts owned %s requests without requiring renewed study consent", async kind => {
    await createPrivacyRequest(student, { ...input, kind });
    expect(db.accountPrivacyRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: { requesterId: student.id, subjectId: student.id, ...input, kind } }));
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
    expect(db.auditEvent.create.mock.calls[0][0].data).not.toHaveProperty("message");
  });
  it("does not execute erasure or export when opening a deletion request", async () => {
    await createPrivacyRequest(student, input); expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(db.accountPrivacyRequest.create.mock.calls[0][0].data).not.toHaveProperty("status");
  });
  it("rejects inactive or stale-role requesters", async () => {
    db.user.findUnique.mockResolvedValue({ ...student, status: "SUSPENDED" }); await expect(createPrivacyRequest(student, input)).rejects.toMatchObject({ status: 403 });
    db.user.findUnique.mockResolvedValue({ ...student, role: "PARENT", status: "ACTIVE" }); await expect(createPrivacyRequest(student, input)).rejects.toMatchObject({ status: 403 });
    expect(db.accountPrivacyRequest.create).not.toHaveBeenCalled();
  });
  it("cannot file for another student", async () => { await expect(createPrivacyRequest(student, { ...input, subjectId: "other" })).rejects.toMatchObject({ status: 403 }); expect(db.accountPrivacyRequest.create).not.toHaveBeenCalled(); });
  it("guardian account role alone cannot file for a child", async () => { actor(parent); await expect(createPrivacyRequest(parent, { ...input, subjectId: student.id })).rejects.toMatchObject({ status: 403 }); expect(db.accountPrivacyRequest.create).not.toHaveBeenCalled(); });
  it("uses actual current guardian authority, not optional progress-sharing permission", async () => {
    actor(parent); db.guardianRegistrationGrant.findFirst.mockResolvedValue({ id: "verified-grant" }); await createPrivacyRequest(parent, { ...input, subjectId: student.id });
    expect(db.guardianRegistrationGrant.findFirst.mock.calls[0][0].where).toMatchObject({ guardianId: parent.id, revokedAt: null, usedAt: { not: null }, receipt: { is: { userId: student.id, user: { role: "STUDENT" } } }, guardian: { role: "PARENT", status: "ACTIVE", accountConsent: { is: { ageBand: "18_PLUS", revokedAt: null } } } });
  });
  it("allows a guardian's own request without looking up a child", async () => { actor(parent); await createPrivacyRequest(parent, input); expect(db.guardianRegistrationGrant.findFirst).not.toHaveBeenCalled(); expect(db.accountPrivacyRequest.create.mock.calls[0][0].data.subjectId).toBe(parent.id); });
  it("replays the same request key without another case or audit", async () => { db.accountPrivacyRequest.findUnique.mockResolvedValue(row()); await createPrivacyRequest(student, input); expect(db.accountPrivacyRequest.create).not.toHaveBeenCalled(); expect(db.auditEvent.create).not.toHaveBeenCalled(); });
  it.each([{ kind: "ACCESS" as const }, { message: "A different request using an existing key." }])("rejects changed replay intent %j", async change => { db.accountPrivacyRequest.findUnique.mockResolvedValue(row()); await expect(createPrivacyRequest(student, { ...input, ...change })).rejects.toMatchObject({ status: 409 }); });
  it("bounds open requests before new writes", async () => { db.accountPrivacyRequest.count.mockResolvedValue(5); await expect(createPrivacyRequest(student, input)).rejects.toThrow("existing requests"); expect(db.accountPrivacyRequest.create).not.toHaveBeenCalled(); });
  it("lists only requester-owned cases and excludes restricted processing evidence", async () => {
    await listPrivacyRequests(student, 2); const query = db.accountPrivacyRequest.findMany.mock.calls[0][0];
    expect(query).toMatchObject({ where: { requesterId: student.id }, skip: 25, take: 26 });
    expect(query.select).not.toHaveProperty("completionReference"); expect(query.select).not.toHaveProperty("reviewerId"); expect(query.select).not.toHaveProperty("requesterId");
  });
  it.each([0, 1001, -1, 1.5, "invalid"])("rejects unbounded page %s", async page => { await expect(listPrivacyRequests(student, page)).rejects.toThrow(); expect(db.accountPrivacyRequest.findMany).not.toHaveBeenCalled(); });
});
describe("private operator processing and requester follow-up", () => {
  beforeEach(() => { db.accountPrivacyRequest.findUnique.mockResolvedValue(row()); db.accountPrivacyRequest.findFirst.mockResolvedValue(row()); });
  it("does not let a parent operate the queue", async () => { actor(parent); await expect(listPrivacyQueue(parent)).rejects.toMatchObject({ status: 403 }); await expect(decidePrivacyRequest(parent, decision)).rejects.toMatchObject({ status: 403 }); expect(db.accountPrivacyRequest.updateMany).not.toHaveBeenCalled(); });
  it("reports that privacy closure requires approval", async () => { actor(admin); expect((await listPrivacyQueue(admin)).processingEnabled).toBe(false); await expect(decidePrivacyRequest(admin, decision)).rejects.toThrow("approved policies"); expect(db.accountPrivacyRequest.updateMany).not.toHaveBeenCalled(); });
  it.each([{ processingVerified: false }, { completionReference: undefined }])("rejects unsupported closure %j", change => { expect(privacyDecisionSchema.safeParse({ ...decision, ...change }).success).toBe(false); });
  it("records reviewed closure with current operator, CAS and minimal audit", async () => {
    actor(admin); vi.stubEnv("ACCOUNT_POLICY_REVIEWED", "true"); vi.stubEnv("ACCOUNT_PRIVACY_PROCESSING_APPROVED", "true"); await decidePrivacyRequest(admin, decision);
    expect(db.accountPrivacyRequest.updateMany).toHaveBeenCalledWith({ where: { id: "case", version: 0, status: "IN_REVIEW" }, data: { status: "RESOLVED", response: decision.response, completionReference: decision.completionReference, reviewerId: admin.id, version: { increment: 1 } } });
    expect(JSON.stringify(db.auditEvent.create.mock.calls)).not.toContain(decision.completionReference);
  });
  it("permits ordinary account-support closure without claiming data erasure", async () => { actor(admin); db.accountPrivacyRequest.findUnique.mockResolvedValue({ ...row(), kind: "ACCOUNT_SUPPORT" }); await decidePrivacyRequest(admin, decision); expect(db.accountPrivacyRequest.updateMany).toHaveBeenCalledOnce(); });
  it("cannot close an unreviewed OPEN request as resolved", async () => { actor(admin); vi.stubEnv("ACCOUNT_POLICY_REVIEWED", "true"); vi.stubEnv("ACCOUNT_PRIVACY_PROCESSING_APPROVED", "true"); db.accountPrivacyRequest.findUnique.mockResolvedValue({ ...row(), status: "OPEN" }); await expect(decidePrivacyRequest(admin, decision)).rejects.toThrow("transition"); });
  it("identical decision replay is read-only even after approval is withdrawn", async () => { actor(admin); db.accountPrivacyRequest.findUnique.mockResolvedValue({ ...row(), version: 1, status: decision.status, response: decision.response, completionReference: decision.completionReference }); await decidePrivacyRequest(admin, decision); expect(db.accountPrivacyRequest.updateMany).not.toHaveBeenCalled(); expect(db.auditEvent.create).not.toHaveBeenCalled(); });
  it("stale and failed-CAS decisions do not write an audit", async () => { actor(admin); db.accountPrivacyRequest.findUnique.mockResolvedValue({ ...row(), version: 3 }); await expect(decidePrivacyRequest(admin, { ...decision, status: "AWAITING_USER" })).rejects.toMatchObject({ status: 409 }); db.accountPrivacyRequest.findUnique.mockResolvedValue(row()); db.accountPrivacyRequest.updateMany.mockResolvedValue({ count: 0 }); await expect(decidePrivacyRequest(admin, { ...decision, status: "AWAITING_USER" })).rejects.toMatchObject({ status: 409 }); expect(db.auditEvent.create).not.toHaveBeenCalled(); });
  it("follow-up is owner-bound and cannot set a status", async () => {
    expect(privacyReplySchema.safeParse({ id: "case", expectedVersion: 0, requestKey: input.requestKey, message: input.message, status: "RESOLVED" }).success).toBe(false);
    db.accountPrivacyRequest.findFirst.mockResolvedValue(null); await expect(replyPrivacyRequest(student, { id: "foreign", expectedVersion: 0, requestKey: input.requestKey, message: input.message })).rejects.toMatchObject({ status: 403 });
  });
  it("returns a follow-up to the queue without overwriting the original request", async () => {
    await replyPrivacyRequest(student, { id: "case", expectedVersion: 0, requestKey: input.requestKey, message: "A clarification of my original request." });
    const query = db.accountPrivacyRequest.updateMany.mock.calls[0][0]; expect(query.where).toMatchObject({ id: "case", requesterId: student.id, version: 0 });
    expect(query.data).toMatchObject({ status: "OPEN", followUpKey: input.requestKey }); expect(query.data).not.toHaveProperty("message"); expect(query.data).not.toHaveProperty("subjectId");
  });
  it("replays a follow-up without another update", async () => { db.accountPrivacyRequest.findFirst.mockResolvedValue({ ...row(), followUpKey: input.requestKey, followUp: input.message, status: "RESOLVED" }); await replyPrivacyRequest(student, { id: "case", expectedVersion: 0, requestKey: input.requestKey, message: input.message }); expect(db.accountPrivacyRequest.updateMany).not.toHaveBeenCalled(); });
  it("rejects a changed follow-up using the same UUID", async () => { db.accountPrivacyRequest.findFirst.mockResolvedValue({ ...row(), followUpKey: input.requestKey, followUp: "Different previous clarification." }); await expect(replyPrivacyRequest(student, { id: "case", expectedVersion: 0, requestKey: input.requestKey, message: input.message })).rejects.toMatchObject({ status: 409 }); });
  it("requires current guardian authority again on child follow-up", async () => { actor(parent); db.accountPrivacyRequest.findFirst.mockResolvedValue({ ...row(), requesterId: parent.id }); await expect(replyPrivacyRequest(parent, { id: "case", expectedVersion: 0, requestKey: input.requestKey, message: input.message })).rejects.toMatchObject({ status: 403 }); expect(db.accountPrivacyRequest.updateMany).not.toHaveBeenCalled(); });
  it.each(["closed", "stale", "rate"])("rejects %s follow-up before a mutation", async failure => {
    if (failure === "closed") db.accountPrivacyRequest.findFirst.mockResolvedValue({ ...row(), status: "RESOLVED" });
    if (failure === "stale") db.accountPrivacyRequest.findFirst.mockResolvedValue({ ...row(), version: 2 });
    if (failure === "rate") db.auditEvent.count.mockResolvedValue(5);
    await expect(replyPrivacyRequest(student, { id: "case", expectedVersion: 0, requestKey: input.requestKey, message: input.message })).rejects.toThrow(); expect(db.accountPrivacyRequest.updateMany).not.toHaveBeenCalled();
  });
  it("migration adds only private case tracking and explicit non-null closure checks", () => { const sql = readFileSync("prisma/migrations/20261022000100_account_privacy_requests/migration.sql", "utf8"); expect(sql).toContain('"response" IS NOT NULL'); expect(sql).toContain('"completionReference" IS NOT NULL'); expect(sql).not.toMatch(/\b(?:DELETE FROM|TRUNCATE|DROP TABLE|INSERT INTO)\b/); });
});
