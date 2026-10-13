import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ConflictApiError, ValidationApiError, AuthorizationApiError } from "@/server/api/errors";
import type { AuthUser } from "@/server/auth/session";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), practiceAttempt: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  studentProfile: { findUnique: vi.fn() }, questionExam: { findFirst: vi.fn() } }));
vi.mock("@/server/db", () => ({ prisma: db }));
import { submitPracticeAnswer, getPracticeHistory, getPracticeHistoryPage } from "@/server/practice/service";
const user: AuthUser = { id: "student", role: "STUDENT", name: "S", email: "s@example.com" };
const input = { requestKey: "8664dc14-a97f-4e63-9747-0a76e597a077", questionId: "q", optionIds: ["a"] };
beforeEach(() => {
  vi.resetAllMocks(); db.$transaction.mockImplementation((fn) => fn(db));
  db.practiceAttempt.findUnique.mockResolvedValue(null); db.studentProfile.findUnique.mockResolvedValue({ targetExamId: "exam" });
  db.questionExam.findFirst.mockResolvedValue({ examId: "exam", marks: new Prisma.Decimal(4), negativeMarks: new Prisma.Decimal(1), scoringMode: "EXACT_SET",
    question: { id: "q", text: "Question", type: "SINGLE_CHOICE", numericalAnswer: null, explanation: "After submission", options: [{ id: "a", isCorrect: true }, { id: "b", isCorrect: false }] } });
  db.practiceAttempt.create.mockResolvedValue({ id: "attempt", score: "4", explanation: "After submission" });
});
describe("practice submission (mocked transactions)", () => {
  it("scores inside an owner-bound serializable transaction", async () => {
    await expect(submitPracticeAnswer(user, input)).resolves.toMatchObject({ id: "attempt", score: "4" });
    expect(db.practiceAttempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: user.id, correct: true, answer: { optionIds: ["a"] } }) }));
    expect(db.questionExam.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ examId: "exam", questionId: "q", question: expect.objectContaining({ reviewStatus: "REVIEWED", active: true }) }) }));
    const selection = db.practiceAttempt.create.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty("answer"); expect(selection).not.toHaveProperty("numericalAnswer");
  });
  it("replays identical requests without a second score or insert", async () => {
    db.practiceAttempt.findUnique.mockResolvedValueOnce({ id: "attempt", questionId: "q", answer: { optionIds: ["a"] } }).mockResolvedValueOnce({ id: "attempt", score: "4" });
    expect(await submitPracticeAnswer(user, input)).toMatchObject({ id: "attempt" });
    expect(db.questionExam.findFirst).not.toHaveBeenCalled(); expect(db.practiceAttempt.create).not.toHaveBeenCalled();
  });
  it("rejects identifier reuse with a different answer", async () => {
    db.practiceAttempt.findUnique.mockResolvedValue({ id: "attempt", questionId: "q", answer: { optionIds: ["b"] } });
    await expect(submitPracticeAnswer(user, input)).rejects.toBeInstanceOf(ConflictApiError); expect(db.practiceAttempt.create).not.toHaveBeenCalled();
  });
  it("rejects inaccessible questions with no attempt", async () => {
    db.questionExam.findFirst.mockResolvedValue(null); await expect(submitPracticeAnswer(user, input)).rejects.toBeInstanceOf(ValidationApiError); expect(db.practiceAttempt.create).not.toHaveBeenCalled();
  });
  it("rejects nonstudents before querying", async () => {
    await expect(submitPracticeAnswer({ ...user, role: "TEACHER" }, input)).rejects.toBeInstanceOf(AuthorizationApiError); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("reads only the authenticated student's attempts", async () => {
    await getPracticeHistory(user); expect(db.practiceAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: user.id }, take: 100 }));
  });
  it.each(["P2002", "P2034"])("retries %s using the same identifier and persisted result", async code => {
    db.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Transient conflict", { code, clientVersion: "7.10.0" }));
    await expect(submitPracticeAnswer(user, input)).resolves.toMatchObject({ id: "attempt" });
    expect(db.$transaction).toHaveBeenCalledTimes(2); expect(db.practiceAttempt.create).toHaveBeenCalledTimes(1);
  });
  it("bounds repeated transaction conflicts", async () => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Conflict", { code: "P2034", clientVersion: "7.10.0" }));
    await expect(submitPracticeAnswer(user, input)).rejects.toMatchObject({ status: 409 }); expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
  it("paginates history with a stable owner-bound cursor", async () => {
    const submittedAt = new Date("2026-10-11T00:00:00Z"); db.practiceAttempt.findFirst.mockResolvedValue({ id: "cursor", submittedAt }); db.practiceAttempt.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({ id: `attempt-${i}` })));
    const page = await getPracticeHistoryPage(user, "cursor"); expect(page.records).toHaveLength(50); expect(page.nextCursor).toBe("attempt-49");
    expect(db.practiceAttempt.findFirst).toHaveBeenCalledWith({ where: { id: "cursor", userId: user.id }, select: { id: true, submittedAt: true } });
    expect(db.practiceAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: user.id, OR: expect.any(Array) }), take: 51 }));
  });
  it("does not accept another student's history cursor", async () => {
    db.practiceAttempt.findFirst.mockResolvedValue(null); await expect(getPracticeHistoryPage(user, "other-student-cursor")).rejects.toMatchObject({ status: 400 }); expect(db.practiceAttempt.findMany).not.toHaveBeenCalled();
  });
});
