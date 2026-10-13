import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), question: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  chapter: { findUnique: vi.fn(), findFirst: vi.fn() }, lesson: { findFirst: vi.fn() }, examSubject: { findUnique: vi.fn(), findFirst: vi.fn() }, exam: { findFirst: vi.fn() },
  questionExam: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, contentEditorialRecord: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  contentSource: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() }, auditEvent: { create: vi.fn() } }));
vi.mock("@/server/db", () => ({ prisma: db }));
import { manageQuestion, assertQuestionReviewed, questionMutationSchema } from "@/server/question/authoring";
import { changePublication } from "@/server/operations/service";
import { editorialFingerprint } from "@/server/content/editorial";
const admin: AuthUser = { id: "reviewer", name: "Admin", email: "a@example.com", role: "PLATFORM_ADMIN" };
const draft = { action: "CREATE" as const, code: "TEST_Q", text: "Original draft question", type: "SINGLE_CHOICE" as const, difficulty: "EASY" as const,
  chapterId: "chapter", explanation: "A reviewed explanation", language: "en", options: [{ code: "A", text: "First", isCorrect: true }, { code: "B", text: "Second", isCorrect: false }],
  exams: [{ examId: "exam", marks: 4, negativeMarks: 1 }], sourceTitle: "Original content", rightsHolder: "Author", origin: "ORIGINAL" as const,
  licence: "Owned content licence", permissionEvidence: "Recorded permission evidence", attribution: "Author" };
const record = { id: "q", code: "TEST_Q", text: "Original draft question", type: "SINGLE_CHOICE", difficulty: "EASY", chapterId: "chapter", subjectId: "subject",
  lessonId: null, explanation: "A reviewed explanation", language: "en", numericalAnswer: null,
  options: [{ id: "a", code: "A", text: "First", isCorrect: true, active: true }, { id: "b", code: "B", text: "Second", isCorrect: false, active: true }],
  exams: [{ id: "link", examId: "exam", marks: new Prisma.Decimal(4), negativeMarks: new Prisma.Decimal(1), scoringMode: "EXACT_SET", active: true }] };
const fingerprint = editorialFingerprint(record);
beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation(fn => fn(db)); db.question.findUnique.mockImplementation(args => Promise.resolve(args.select.status ? { status: "DRAFT" } : record));
  db.chapter.findUnique.mockResolvedValue({ subjectId: "subject" }); db.chapter.findFirst.mockResolvedValue({ id: "chapter" }); db.exam.findFirst.mockResolvedValue({ id: "exam" });
  db.examSubject.findUnique.mockResolvedValue({ id: "association" }); db.examSubject.findFirst.mockResolvedValue({ id: "association" }); db.question.create.mockResolvedValue({ id: "q" }); db.question.findFirst.mockResolvedValue(null);
  db.contentEditorialRecord.findUnique.mockResolvedValue({ revision: 1, reviewedRevision: 1, authorId: "author", reviewerId: admin.id, reviewedAt: new Date(), reviewedFingerprint: fingerprint, reviewEvidence: "Independent review evidence" });
  db.contentSource.findUnique.mockResolvedValue({ authorId: "author", reviewerId: admin.id, reviewedAt: new Date(), contentFingerprint: fingerprint, rightsHolder: "Author", licence: "Owned licence", permissionEvidence: "Permission evidence" });
});
describe("question authoring and publication (mocked transactions)", () => {
  it.each(["STUDENT", "TEACHER", "PARENT", "SCHOOL_ADMIN"] as const)("denies %s before database access", async role => {
    await expect(manageQuestion({ ...admin, role }, draft)).rejects.toMatchObject({ status: 403 }); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("creates only a draft, stores answers privately and shares editorial/source records", async () => {
    await manageQuestion(admin, draft);
    expect(db.question.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT", reviewStatus: "NEEDS_REVIEW", subjectId: "subject" }) }));
    expect(db.contentSource.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entity: "QUESTION", contentFingerprint: fingerprint }) }));
    expect(db.contentSource.create.mock.calls[0][0].data).not.toHaveProperty("reviewerId");
    expect(db.auditEvent.create).toHaveBeenCalledWith({ data: { actorId: admin.id, entity: "QUESTION", entityId: "q", action: "QUESTION_CREATE" } });
  });
  it("rejects client review, status and identity claims", () => {
    for (const field of ["reviewStatus", "status", "authorId", "id"]) expect(questionMutationSchema.safeParse({ ...draft, [field]: "REVIEWED" }).success).toBe(false);
  });
  it("validates scoring shapes, duplicates and numerical formats", () => {
    expect(questionMutationSchema.safeParse({ ...draft, options: [draft.options[0], draft.options[0]] }).success).toBe(false);
    expect(questionMutationSchema.safeParse({ ...draft, type: "NUMERICAL", numericalAnswer: "1e2", options: [] }).success).toBe(false);
    expect(questionMutationSchema.safeParse({ ...draft, type: "NUMERICAL", numericalAnswer: "0", options: [] }).success).toBe(true);
    expect(questionMutationSchema.safeParse({ ...draft, options: draft.options.map(o => ({ ...o, isCorrect: false })) }).success).toBe(false);
  });
  it("rejects mismatched chapter/lesson and exam/subject before writes", async () => {
    db.examSubject.findUnique.mockResolvedValue(null); await expect(manageQuestion(admin, draft)).rejects.toMatchObject({ status: 400 }); expect(db.question.create).not.toHaveBeenCalled();
    db.examSubject.findUnique.mockResolvedValue({ id: "link" }); db.lesson.findFirst.mockResolvedValue(null);
    await expect(manageQuestion(admin, { ...draft, lessonId: "wrong" })).rejects.toMatchObject({ status: 400 }); expect(db.question.create).not.toHaveBeenCalled();
  });
  it("rejects exact duplicates before inserting", async () => { db.question.findFirst.mockResolvedValue({ id: "duplicate" }); await expect(manageQuestion(admin, draft)).rejects.toMatchObject({ status: 409 }); expect(db.question.create).not.toHaveBeenCalled(); });
  it("creates a linked successor without rewriting the original or its attempts", async () => {
    await manageQuestion(admin, { ...draft, code: "TEST_Q_V2", supersedesId: "old-question" });
    expect(db.question.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supersedesId: "old-question", status: "DRAFT" }) }));
    expect(db.question.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { not: "old-question" } }) })); expect(db.question.update).not.toHaveBeenCalled();
  });
  it("rejects a successor attached to a different chapter", async () => {
    db.question.findUnique.mockResolvedValue({ chapterId: "another" }); await expect(manageQuestion(admin, { ...draft, supersedesId: "old-question" })).rejects.toMatchObject({ status: 400 }); expect(db.question.create).not.toHaveBeenCalled();
  });
  it("requires an independent reviewer", async () => {
    db.contentEditorialRecord.findUnique.mockResolvedValue({ authorId: admin.id });
    await expect(manageQuestion(admin, { action: "REVIEW", id: "q", fingerprint, evidence: "Checked all content" })).rejects.toMatchObject({ status: 400 }); expect(db.question.update).not.toHaveBeenCalled();
  });
  it("rejects stale decisions", async () => {
    await expect(manageQuestion(admin, { action: "PUBLISH", id: "q", fingerprint: "0".repeat(64), evidence: "Publish after review" })).rejects.toMatchObject({ status: 409 }); expect(db.question.update).not.toHaveBeenCalled();
  });
  it("records independent review and does not publish during approval", async () => {
    await manageQuestion(admin, { action: "REVIEW", id: "q", fingerprint, evidence: "Reviewed explanation, answers and rights" });
    expect(db.contentEditorialRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewerId: admin.id, reviewedAt: expect.any(Date), reviewedRevision: 1 }) }));
    expect(db.contentSource.update).toHaveBeenCalled(); expect(db.question.update).toHaveBeenCalledWith({ where: { id: "q" }, data: { reviewStatus: "REVIEWED" } }); expect(db.questionExam.updateMany).not.toHaveBeenCalled();
  });
  it("publishes reviewed scored content and links atomically", async () => {
    await manageQuestion(admin, { action: "PUBLISH", id: "q", fingerprint, evidence: "Publish after review" });
    expect(db.questionExam.updateMany).toHaveBeenCalledWith({ where: { questionId: "q" }, data: { status: "PUBLISHED", active: true } });
    expect(db.question.update).toHaveBeenCalledWith({ where: { id: "q" }, data: { status: "PUBLISHED", active: true, reviewStatus: "REVIEWED" } });
  });
  it("rejects missing rights and stale explanation review", async () => {
    db.contentSource.findUnique.mockResolvedValue(null); await expect(assertQuestionReviewed(db as never, "q")).rejects.toMatchObject({ status: 400 });
    db.contentSource.findUnique.mockResolvedValue({ authorId: "author", reviewerId: "reviewer", reviewedAt: new Date(), contentFingerprint: fingerprint, licence: "Owned", rightsHolder: "Author", permissionEvidence: "Evidence" });
    db.question.findUnique.mockResolvedValue({ ...record, explanation: "Changed explanation" }); await expect(assertQuestionReviewed(db as never, "q")).rejects.toMatchObject({ status: 400 });
  });
  it("does not publish a retired exam subject association", async () => {
    db.examSubject.findFirst.mockResolvedValue(null);
    await expect(manageQuestion(admin, { action: "PUBLISH", id: "q", fingerprint, evidence: "Publish after review" })).rejects.toMatchObject({ status: 400 }); expect(db.question.update).not.toHaveBeenCalled();
  });
  it("closes legacy publication and REVIEWED flag bypasses", async () => {
    db.contentEditorialRecord.findUnique.mockResolvedValue(null);
    await expect(changePublication(admin, { entity: "QUESTION", id: "q", status: "DRAFT", active: true, reviewStatus: "REVIEWED" })).rejects.toMatchObject({ status: 400 }); expect(db.question.update).not.toHaveBeenCalled();
  });
  it("does not permit scoring changes to used exam links", async () => {
    db.questionExam.findUnique.mockResolvedValue({ questionId: "q", scoringMode: "EXACT_SET" });
    await expect(changePublication(admin, { entity: "QUESTION_EXAM", id: "link", status: "PUBLISHED", active: true, scoringMode: "DECIMAL_EXACT" })).rejects.toMatchObject({ status: 400 }); expect(db.questionExam.update).not.toHaveBeenCalled();
  });
  it("archives without altering the historical question or answer", async () => {
    await manageQuestion(admin, { action: "ARCHIVE", id: "q", fingerprint, evidence: "Retired original question" });
    expect(db.question.update).toHaveBeenCalledWith({ where: { id: "q" }, data: { status: "ARCHIVED", active: false } });
  });
});
