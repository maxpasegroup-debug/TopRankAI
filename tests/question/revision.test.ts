import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/server/auth/session";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), practiceAttempt: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  practiceRevisionState: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() }, question: { findFirst: vi.fn() }, studentProfile: { findUnique: vi.fn() } }));
vi.mock("@/server/db", () => ({ prisma: db }));
import { getPracticeRevision, mutatePracticeRevision, revisionMutationSchema } from "@/server/practice/revision";
const user: AuthUser = { id: "student", role: "STUDENT", name: "S", email: "s@example.com" };
const date = new Date("2026-10-11T06:00:00Z");
const question = { id: "q", text: "Question", status: "PUBLISHED", active: true, reviewStatus: "REVIEWED",
  subject: { name: "Subject", status: "PUBLISHED", active: true }, chapter: { status: "PUBLISHED", active: true }, lesson: null, exams: [{ examId: "exam", scoringMode: "EXACT_SET" }] };
const attempt = { id: "a", questionId: "q", questionText: "Saved question text", correct: false, explanation: "Saved explanation", submittedAt: date, question };
beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation(fn => fn(db)); db.studentProfile.findUnique.mockResolvedValue({ targetExamId: "exam" });
  db.practiceAttempt.findMany.mockResolvedValue([attempt]); db.practiceRevisionState.findMany.mockResolvedValue([]); db.practiceRevisionState.findUnique.mockResolvedValue(null);
  db.practiceAttempt.findFirst.mockResolvedValue({ id: "a" }); db.question.findFirst.mockResolvedValue({ id: "q" }); });
describe("practice mistake and bookmark revision (mocked persistence)", () => {
  it.each(["TEACHER", "PARENT", "SCHOOL_ADMIN", "PLATFORM_ADMIN"] as const)("rejects %s before querying", async role => {
    await expect(getPracticeRevision({ ...user, role })).rejects.toMatchObject({ status: 403 });
    await expect(mutatePracticeRevision({ ...user, role }, { questionId: "q", action: "BOOKMARK", bookmarked: true })).rejects.toMatchObject({ status: 403 }); expect(db.studentProfile.findUnique).not.toHaveBeenCalled();
  });
  it("uses owner-bound latest attempts and preserves their explanation", async () => {
    const data = await getPracticeRevision(user); expect(data.entries[0]).toMatchObject({ text: "Saved question text", explanation: "Saved explanation", incorrect: true, available: true });
    expect(db.practiceAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: user.id }, distinct: ["questionId"], take: 101 }));
    expect(JSON.stringify(data)).not.toMatch(/numericalAnswer|isCorrect|optionIds/);
  });
  it("does not call a correct retry mastery or retain it as a mistake", async () => { db.practiceAttempt.findMany.mockResolvedValue([{ ...attempt, correct: true }]); expect((await getPracticeRevision(user)).entries).toEqual([]); });
  it("retains a bookmarked correct retry", async () => {
    db.practiceAttempt.findMany.mockResolvedValue([{ ...attempt, correct: true }]); db.practiceRevisionState.findMany.mockResolvedValue([{ questionId: "q", bookmarked: true, reviewedAt: null, question }]);
    expect((await getPracticeRevision(user)).entries[0]).toMatchObject({ bookmarked: true, incorrect: false });
  });
  it("bookmarked unattempted questions disclose no explanation", async () => {
    db.practiceAttempt.findMany.mockResolvedValue([]); db.practiceRevisionState.findMany.mockResolvedValue([{ questionId: "q", bookmarked: true, reviewedAt: null, question }]);
    expect((await getPracticeRevision(user)).entries[0]).toMatchObject({ explanation: null, attemptId: null });
  });
  it("a new mistake after review becomes pending again", async () => {
    db.practiceRevisionState.findMany.mockResolvedValue([{ questionId: "q", bookmarked: false, reviewedAt: new Date(date.getTime() - 1), question }]); expect((await getPracticeRevision(user)).entries[0].reviewed).toBe(false);
  });
  it("unavailable or different-exam questions retain history but no retry link", async () => {
    db.studentProfile.findUnique.mockResolvedValue({ targetExamId: "another" }); expect((await getPracticeRevision(user)).entries[0]).toMatchObject({ available: false, explanation: "Saved explanation" });
  });
  it("bookmark mutation uses authenticated ownership and absolute state", async () => {
    await mutatePracticeRevision(user, { questionId: "q", action: "BOOKMARK", bookmarked: true });
    expect(db.practiceRevisionState.upsert).toHaveBeenCalledWith({ where: { userId_questionId: { userId: "student", questionId: "q" } }, create: { userId: "student", questionId: "q", bookmarked: true }, update: { bookmarked: true } });
  });
  it("rejects unavailable bookmarks without writes", async () => { db.question.findFirst.mockResolvedValue(null); await expect(mutatePracticeRevision(user, { questionId: "q", action: "BOOKMARK", bookmarked: true })).rejects.toMatchObject({ status: 400 }); expect(db.practiceRevisionState.upsert).not.toHaveBeenCalled(); });
  it("rejects review of a different owner or superseded attempt", async () => { db.practiceAttempt.findFirst.mockResolvedValue({ id: "new" }); await expect(mutatePracticeRevision(user, { questionId: "q", action: "REVIEW", attemptId: "a" })).rejects.toMatchObject({ status: 409 }); expect(db.practiceRevisionState.upsert).not.toHaveBeenCalled(); });
  it("review is bound to latest attempt, not a client timestamp", async () => {
    expect(revisionMutationSchema.safeParse({ action: "REVIEW", questionId: "q", attemptId: "a", reviewedAt: date.toISOString() }).success).toBe(false);
    await mutatePracticeRevision(user, { action: "REVIEW", questionId: "q", attemptId: "a" }); expect(db.practiceRevisionState.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { reviewedAt: expect.any(Date) } }));
  });
  it("replays completed review without advancing its timestamp", async () => {
    db.practiceRevisionState.findUnique.mockResolvedValue({ reviewedAt: date }); db.practiceAttempt.findUnique.mockResolvedValue({ submittedAt: date });
    await mutatePracticeRevision(user, { action: "REVIEW", questionId: "q", attemptId: "a" }); expect(db.practiceRevisionState.upsert).not.toHaveBeenCalled();
  });
});
