import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Prisma } from "@/generated/prisma/client";
import { AuthorizationApiError, ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { contentImportSchema, draftRecordSchema, reviewContentSchema } from "@/server/content/authoring-validation";
import { isTeachingBody, lessonSectionKinds } from "@/shared/lesson-content";
const db = vi.hoisted(() => {
  const delegate = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() });
  return { $transaction: vi.fn(), exam: delegate(), subject: delegate(), examSubject: delegate(), chapter: delegate(), lesson: delegate(), learningResource: delegate(),
    contentSource: { findUnique: vi.fn() }, contentEditorialRecord: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() }, auditEvent: { create: vi.fn() } };
});
vi.mock("@/server/db", () => ({ prisma: db }));
import { importContentDrafts, listEditorialContent, reviewContent, saveContentDraft } from "@/server/content/authoring";
import { assertReviewedPublication, editorialFingerprint } from "@/server/content/editorial";
import { changePublication } from "@/server/operations/service";
import { getLaunchContentCoverage } from "@/server/content/coverage";
const admin = { id: "author", role: "PLATFORM_ADMIN" as const, name: "Author", email: "author@example.com" };
const reviewer = { ...admin, id: "reviewer" };
const body = { version: 1 as const, sourceNote: "Original draft for independent review", sections: lessonSectionKinds.map(kind => ({ kind, title: kind, text: "Original explanatory content with a worked check." })) };
const lesson = { id: "l1", chapterId: "c1", title: "Test lesson", slug: "test-lesson", summary: "Foundation", order: 1, body };
const review = () => ({ entity: "LESSON", entityId: "l1", revision: 2, authorId: admin.id, reviewerId: reviewer.id, reviewedRevision: 2, reviewedAt: new Date(), reviewEvidence: "review-evidence-1", reviewedFingerprint: editorialFingerprint(lesson) });
beforeEach(() => {
  vi.resetAllMocks(); db.$transaction.mockImplementation(fn => fn(db)); db.lesson.findUnique.mockResolvedValue(lesson); db.chapter.findUnique.mockResolvedValue({ id: "c1", subjectId: "s1" });
  db.chapter.findFirst.mockResolvedValue({ id: "c1" }); db.lesson.create.mockResolvedValue(lesson); db.lesson.update.mockResolvedValue(lesson);
  db.contentEditorialRecord.findUnique.mockResolvedValue(review()); db.contentEditorialRecord.upsert.mockResolvedValue({ revision: 3 }); db.contentEditorialRecord.updateMany.mockResolvedValue({ count: 1 });
  db.contentSource.findUnique.mockResolvedValue({ authorId: "source-author", reviewerId: "source-reviewer", reviewedAt: new Date(), licence: "Original content", rightsHolder: "TopRank AI", permissionEvidence: "rights-reference", contentFingerprint: editorialFingerprint(lesson) });
});
describe("editorial validation and bounded launch drafts", () => {
  it.each(lessonSectionKinds)("requires %s for reviewable teaching content", kind => expect(isTeachingBody({ ...body, sections: body.sections.filter(section => section.kind !== kind) })).toBe(false));
  it("requires source provenance and bounded sections", () => { expect(isTeachingBody(body)).toBe(true); expect(isTeachingBody({ ...body, sourceNote: "" })).toBe(false); expect(isTeachingBody({ ...body, sections: Array(25).fill(body.sections[0]) })).toBe(false); });
  it("rejects publish/ownership injection and missing revision", () => {
    const draft = { entity: "LESSON", ...lesson };
    expect(draftRecordSchema.safeParse(draft).success).toBe(false);
    expect(draftRecordSchema.safeParse({ ...draft, revision: 2, status: "PUBLISHED" }).success).toBe(false);
    expect(draftRecordSchema.safeParse({ ...draft, revision: 2, reviewerId: reviewer.id }).success).toBe(false);
  });
  it.each(["javascript:alert(1)", "http://example.com", "https://user:pass@example.com"])("rejects unsafe resource %s", url => expect(draftRecordSchema.safeParse({ entity: "RESOURCE", lessonId: "l1", title: "Notes", slug: "notes", type: "NOTES", url, reference: "", order: 1 }).success).toBe(false));
  it("requires review evidence and explicit confirmations", () => expect(reviewContentSchema.safeParse({ entity: "LESSON", id: "l1", revision: 2, evidence: "reviewed" }).success).toBe(false));
  it("validates original draft pack without pretending independent review", () => {
    const pack = contentImportSchema.parse(JSON.parse(readFileSync("content/launch/jee-neet-foundation-drafts.json", "utf8")));
    expect(pack.records).toHaveLength(32); const lessons = pack.records.filter(record => record.draft.entity === "LESSON"); expect(lessons).toHaveLength(8);
    for (const { draft } of lessons) if (draft.entity === "LESSON") { expect(isTeachingBody(draft.body)).toBe(true); expect(draft.body.sourceNote).toContain("Not independently educator-reviewed"); }
    expect(pack.records.filter(record => record.draft.entity === "EXAM").map(record => record.draft.entity === "EXAM" ? record.draft.code : "")).toEqual(["JEE_MAIN", "NEET"]);
  });
  it("rejects duplicate keys, large batches and import overwrites", () => {
    const entry = { key: "subject", draft: { entity: "SUBJECT", code: "SCIENCE", name: "Science", slug: "science" } };
    expect(contentImportSchema.safeParse({ version: 1, records: [entry, entry] }).success).toBe(false);
    expect(contentImportSchema.safeParse({ version: 1, records: Array.from({ length: 61 }, (_, i) => ({ ...entry, key: "subject-" + i })) }).success).toBe(false);
    expect(contentImportSchema.safeParse({ version: 1, records: [{ ...entry, draft: { ...entry.draft, id: "old", revision: 1 } }] }).success).toBe(false);
  });
});
describe("revision-bound publication and authoring (mocked persistence)", () => {
  it.each(["STUDENT", "PARENT", "TEACHER", "SCHOOL_ADMIN"] as const)("denies %s authoring/review/import before persistence", async role => {
    const actor = { ...admin, role };
    await expect(saveContentDraft(actor, { entity: "LESSON", ...lesson, revision: 2 })).rejects.toBeInstanceOf(AuthorizationApiError);
    await expect(reviewContent(actor, { entity: "LESSON", id: "l1", revision: 2, evidence: "review-evidence", accuracyConfirmed: true, rightsConfirmed: true })).rejects.toBeInstanceOf(AuthorizationApiError);
    await expect(importContentDrafts(actor, { version: 1, records: [] })).rejects.toBeInstanceOf(AuthorizationApiError); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("saves unreviewed revisions and clears review metadata in a serializable transaction", async () => {
    db.contentEditorialRecord.findUnique.mockResolvedValue({ ...review(), reviewedAt: null, reviewedRevision: null });
    await saveContentDraft(admin, { entity: "LESSON", ...lesson, revision: 2 });
    expect(db.lesson.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT", body }) }));
    expect(db.contentEditorialRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ revision: { increment: 1 }, authorId: admin.id, reviewerId: null, reviewedFingerprint: null }) }));
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
  it("rejects stale edits and parent reassignment before content writes", async () => {
    await expect(saveContentDraft(admin, { entity: "LESSON", ...lesson, revision: 1 })).rejects.toBeInstanceOf(ConflictApiError);
    await expect(saveContentDraft(admin, { entity: "LESSON", ...lesson, chapterId: "other", revision: 2 })).rejects.toBeInstanceOf(ValidationApiError); expect(db.lesson.update).not.toHaveBeenCalled();
  });
  it("rejects missing parents", async () => { db.chapter.findUnique.mockResolvedValue(null); await expect(saveContentDraft(admin, { entity: "LESSON", ...lesson, revision: 2 })).rejects.toBeInstanceOf(ValidationApiError); expect(db.lesson.update).not.toHaveBeenCalled(); });
  it("cannot self-review a revision", async () => { await expect(reviewContent(admin, { entity: "LESSON", id: "l1", revision: 2, evidence: "review-evidence", accuracyConfirmed: true, rightsConfirmed: true })).rejects.toThrow("different reviewer"); expect(db.contentEditorialRecord.updateMany).not.toHaveBeenCalled(); });
  it("records independent current-revision review with a fingerprint", async () => {
    await reviewContent(reviewer, { entity: "LESSON", id: "l1", revision: 2, evidence: "review-evidence", accuracyConfirmed: true, rightsConfirmed: true });
    expect(db.contentEditorialRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { entity: "LESSON", entityId: "l1", revision: 2 }, data: expect.objectContaining({ reviewerId: reviewer.id, reviewedFingerprint: editorialFingerprint(lesson) }) }));
  });
  it.each(["missing", "stale", "self", "tampered", "incomplete"])("rejects %s review through existing publication", async failure => {
    const value = review(); if (failure === "missing") db.contentEditorialRecord.findUnique.mockResolvedValue(null);
    if (failure === "stale") value.reviewedRevision = 1; if (failure === "self") value.reviewerId = admin.id; if (failure === "tampered") value.reviewedFingerprint = "0".repeat(64); if (failure === "incomplete") value.reviewEvidence = "";
    if (failure !== "missing") db.contentEditorialRecord.findUnique.mockResolvedValue(value);
    await expect(changePublication(admin, { entity: "LESSON", id: "l1", status: "PUBLISHED", active: true })).rejects.toBeInstanceOf(ValidationApiError); expect(db.lesson.update).not.toHaveBeenCalled(); expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
  it("publishes reviewed content only with an available parent", async () => {
    await changePublication(admin, { entity: "LESSON", id: "l1", status: "PUBLISHED", active: true }); expect(db.lesson.update).toHaveBeenCalledOnce();
    db.chapter.findFirst.mockResolvedValue(null); await expect(assertReviewedPublication(db as unknown as Prisma.TransactionClient, "LESSON", "l1")).rejects.toThrow("parent");
  });
  it("fingerprints objects independent of property order", () => { expect(editorialFingerprint({ a: 1, b: { c: 2, d: 3 } })).toBe(editorialFingerprint({ b: { d: 3, c: 2 }, a: 1 })); expect(editorialFingerprint(body)).not.toBe(editorialFingerprint({ ...body, sourceNote: "changed" })); });
  it("rejects forward import references before the affected write", async () => {
    await expect(importContentDrafts(admin, { version: 1, records: [{ key: "chapter", draft: { entity: "CHAPTER", subjectId: "@missing", title: "Chapter", slug: "chapter", summary: "", order: 1 } }] })).rejects.toThrow("earlier record"); expect(db.chapter.create).not.toHaveBeenCalled();
  });
  it("imports only audited drafts with resolved earlier parents", async () => {
    db.subject.create.mockResolvedValue({ id: "s1" }); db.subject.findUnique.mockResolvedValue({ id: "s1" }); db.chapter.create.mockResolvedValue({ id: "c1" });
    await expect(importContentDrafts(admin, { version: 1, records: [{ key: "subject", draft: { entity: "SUBJECT", code: "SCIENCE", name: "Science", slug: "science" } }, { key: "chapter", draft: { entity: "CHAPTER", subjectId: "@subject", title: "Chapter", slug: "chapter", summary: "", order: 1 } }] })).resolves.toMatchObject({ imported: 2 });
    expect(db.chapter.create).toHaveBeenCalledWith({ data: expect.objectContaining({ subjectId: "s1", status: "DRAFT" }) }); expect(db.$transaction).toHaveBeenCalledOnce();
  });
  it("bounds listing and advances its cursor", async () => {
    db.lesson.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({ ...lesson, id: "l" + i }))); db.contentEditorialRecord.findMany.mockResolvedValue([]);
    const result = await listEditorialContent(admin, "LESSON", "last"); expect(result.records).toHaveLength(50); expect(result.nextCursor).toBe("l49"); expect(db.lesson.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51, cursor: { id: "last" }, skip: 1 }));
  });
  it("separates missing catalog and unreviewed published content in coverage", async () => {
    db.exam.findMany.mockResolvedValue([{ id: "exam", code: "JEE_MAIN", status: "PUBLISHED", active: true }]);
    db.examSubject.findMany.mockResolvedValue([{ examId: "exam", status: "PUBLISHED", active: true, subject: { id: "s1", code: "PHYSICS", status: "PUBLISHED", active: true } }]);
    db.chapter.findMany.mockResolvedValue([{ id: "c1", subjectId: "s1" }]); db.lesson.findMany.mockResolvedValue([lesson]); db.contentEditorialRecord.findMany.mockResolvedValue([]);
    const result = await getLaunchContentCoverage(admin); expect(result.exams[0].subjects[0]).toMatchObject({ publishedLessons: 1, reviewedLessons: 0, pendingReview: 1 }); expect(result.exams[1].available).toBe(false); expect(result.coverageSignoffRequired).toBe(true);
  });
});
