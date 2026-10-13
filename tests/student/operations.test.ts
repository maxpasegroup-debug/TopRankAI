import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/server/auth/session";
import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), exam: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  contentEditorialRecord: { findUnique: vi.fn() }, contentSource: { findUnique: vi.fn() },
  question: { findUnique: vi.fn(), update: vi.fn() }, learningResource: { findUnique: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() }, commerceNotification: { upsert: vi.fn() }, helpRequest: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn(), upsert: vi.fn() } }));
vi.mock("@/server/db", () => ({ prisma: db }));
import { changePublication, listPublicationRecords, respondToHelp, publicationSchema, createExam, examCreateSchema, helpResponseSchema, listSupportQueue } from "@/server/operations/service";
import { createHelpRequest, listHelpRequests } from "@/server/help/service";
import { editorialFingerprint } from "@/server/content/editorial";
const admin: AuthUser = { id: "admin", role: "PLATFORM_ADMIN", name: "A", email: "a@example.com" };
const student: AuthUser = { ...admin, id: "student", role: "STUDENT" };
const publication = { entity: "EXAM" as const, id: "exam", status: "PUBLISHED" as const, active: true };
beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation((fn) => fn(db)); });
describe("publication and support ownership (mocked persistence)", () => {
  it("creates new exams only as audited drafts", async () => {
    db.exam.create.mockResolvedValue({ id: "new-exam" });
    await createExam(admin, { code: "TEST_EXAM", name: "Test exam", category: "OTHER" });
    expect(db.exam.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT" }) }));
    expect(db.auditEvent.create).toHaveBeenCalledWith({ data: { actorId: admin.id, entity: "EXAM", entityId: "new-exam", action: "EXAM_CREATED_DRAFT" } });
    expect(examCreateSchema.safeParse({ code: "TEST", name: "Test exam", category: "OTHER", officialUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it.each(["STUDENT", "TEACHER", "PARENT", "SCHOOL_ADMIN"] as const)("denies %s global publication permissions", async (role) => {
    await expect(changePublication({ ...admin, role }, publication)).rejects.toBeInstanceOf(AuthorizationApiError);
    await expect(listPublicationRecords({ ...admin, role }, "EXAM")).rejects.toBeInstanceOf(AuthorizationApiError);
    expect(db.$transaction).not.toHaveBeenCalled(); expect(db.exam.findMany).not.toHaveBeenCalled();
  });
  it("writes publication and minimal audit metadata together", async () => {
    const record = { id: "exam", code: "TEST", name: "Test exam", category: "OTHER", description: "", officialUrl: null };
    db.exam.findUnique.mockResolvedValue(record);
    db.contentEditorialRecord.findUnique.mockResolvedValue({ revision: 1, reviewedRevision: 1, authorId: "author", reviewerId: admin.id, reviewedAt: new Date(), reviewEvidence: "review-evidence", reviewedFingerprint: editorialFingerprint(record) });
    db.contentSource.findUnique.mockResolvedValue({ authorId: "source-author", reviewerId: admin.id, reviewedAt: new Date(), licence: "Reference only", rightsHolder: "Rights holder", permissionEvidence: "source-evidence", contentFingerprint: editorialFingerprint(record) });
    await changePublication(admin, publication); expect(db.auditEvent.create).toHaveBeenCalledWith({ data: { actorId: admin.id, entity: "EXAM", entityId: "exam", action: "PUBLICATION_PUBLISHED" } });
  });
  it("rejects publishing unsafe links before update", async () => {
    db.learningResource.findUnique.mockResolvedValue({ url: "javascript:alert(1)" });
    await expect(changePublication(admin, { ...publication, entity: "RESOURCE" })).rejects.toBeInstanceOf(ValidationApiError);
    expect(db.learningResource.update).not.toHaveBeenCalled(); expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
  it("rejects unreviewed question publication", async () => {
    db.question.findUnique.mockResolvedValue({ reviewStatus: "NEEDS_REVIEW", exams: [] });
    await expect(changePublication(admin, { ...publication, entity: "QUESTION" })).rejects.toBeInstanceOf(ValidationApiError);
    expect(db.question.update).not.toHaveBeenCalled(); expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
  it("denies scoring and review fields for the wrong entity", () => {
    expect(publicationSchema.safeParse({ ...publication, scoringMode: "EXACT_SET" }).success).toBe(false);
    expect(publicationSchema.safeParse({ ...publication, reviewStatus: "REVIEWED" }).success).toBe(false);
  });
  it("audits support response without private messages in audit records", async () => {
    db.helpRequest.findUnique.mockResolvedValue({ id: "help", userId: student.id, version: 0, status: "OPEN", response: null }); db.helpRequest.updateMany.mockResolvedValue({ count: 1 });
    await respondToHelp(admin, { id: "help", version: 0, status: "RESOLVED", response: "Study guidance" });
    expect(db.auditEvent.create).toHaveBeenCalledWith({ data: { actorId: admin.id, entity: "HELP_REQUEST", entityId: "help", action: "HELP_RESOLVED" } });
  });
  it("bounds student support reads to their own records", async () => {
    await listHelpRequests(student); expect(db.helpRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: student.id }, take: 100 }));
  });
  it("uses owner-bound idempotency keys for help creation", async () => {
    const input = { requestKey: "8664dc14-a97f-4e63-9747-0a76e597a077", subject: "Need help", message: "Please explain this concept" };
    db.helpRequest.upsert.mockResolvedValue({ id: "help", ...input });
    await expect(createHelpRequest(student, input)).resolves.toMatchObject({ id: "help" });
    expect(db.helpRequest.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_requestKey: { userId: student.id, requestKey: input.requestKey } }, update: {} }));
  });
});

describe("versioned support responses (mocked persistence)", () => {
  const input = { id: "help", version: 0, status: "RESOLVED" as const, response: "Private response text" };
  beforeEach(() => { db.helpRequest.findUnique.mockResolvedValue({ id: "help", userId: student.id, version: 0, status: "OPEN", response: null }); db.helpRequest.updateMany.mockResolvedValue({ count: 1 }); });
  it("atomically writes a versioned response and a generic owner-only notice", async () => {
    expect(await respondToHelp(admin, input)).toEqual({ id: "help", version: 1 });
    expect(db.helpRequest.updateMany.mock.calls[0][0]).toEqual({ where: { id: "help", version: 0 }, data: { status: "RESOLVED", response: input.response, version: { increment: 1 } } });
    expect(db.commerceNotification.upsert.mock.calls[0][0]).toMatchObject({ create: { userId: student.id, channel: "IN_APP", template: "SUPPORT_UPDATED", eventKey: "help:help:1" }, update: {} });
    expect(JSON.stringify(db.commerceNotification.upsert.mock.calls)).not.toContain(input.response); expect(JSON.stringify(db.auditEvent.create.mock.calls)).not.toContain(input.response);
  });
  it("rejects stale edits with no audit or notice", async () => { db.helpRequest.updateMany.mockResolvedValue({ count: 0 }); await expect(respondToHelp(admin, input)).rejects.toMatchObject({ status: 409 }); expect(db.auditEvent.create).not.toHaveBeenCalled(); expect(db.commerceNotification.upsert).not.toHaveBeenCalled(); });
  it("replays a lost acknowledgement without another write or notice", async () => { db.helpRequest.findUnique.mockResolvedValue({ id: "help", version: 1, status: input.status, response: input.response }); expect(await respondToHelp(admin, input)).toEqual({ id: "help", version: 1 }); expect(db.helpRequest.updateMany).not.toHaveBeenCalled(); expect(db.commerceNotification.upsert).not.toHaveBeenCalled(); });
  it("rejects missing requests before writes", async () => { db.helpRequest.findUnique.mockResolvedValue(null); await expect(respondToHelp(admin, input)).rejects.toMatchObject({ status: 400 }); expect(db.helpRequest.updateMany).not.toHaveBeenCalled(); });
  it.each(["STUDENT", "PARENT", "TEACHER", "SCHOOL_ADMIN"] as const)("denies %s responses and queue reads", async role => { await expect(respondToHelp({ ...admin, role }, input)).rejects.toThrow(); await expect(listSupportQueue({ ...admin, role })).rejects.toThrow(); expect(db.$transaction).not.toHaveBeenCalled(); expect(db.helpRequest.findMany).not.toHaveBeenCalled(); });
  it.each([{ ...input, version: -1 }, { ...input, version: 0.5 }, { ...input, response: " " }, { ...input, userId: "foreign" }])("rejects invalid response %j", async forged => { expect(helpResponseSchema.safeParse(forged).success).toBe(false); await expect(respondToHelp(admin, forged)).rejects.toThrow(); expect(db.$transaction).not.toHaveBeenCalled(); });
  it("prioritizes active requests with stable bounded queue ordering", async () => { await listSupportQueue(admin); expect(db.helpRequest.findMany.mock.calls[0][0]).toMatchObject({ take: 100, orderBy: [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }] }); });
  it("propagates notice failure inside the transaction instead of claiming success", async () => { db.commerceNotification.upsert.mockRejectedValue(new Error("notice unavailable")); await expect(respondToHelp(admin, input)).rejects.toThrow("notice unavailable"); expect(db.auditEvent.create).not.toHaveBeenCalled(); });
});
