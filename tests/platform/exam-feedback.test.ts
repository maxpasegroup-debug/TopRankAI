import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  background: [] as (() => Promise<void>)[],
  generate: vi.fn(),
  enabled: true,
  fallback: { headline: "Recorded result", summary: "Saved score", strengths: [], focusAreas: [], nextSteps: [] },
  db: {
    examAttempt: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    question: { findMany: vi.fn() },
    questionExam: { findMany: vi.fn() },
    syllabusTopic: { findMany: vi.fn() },
    userAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
    dailyExam: { update: vi.fn() },
    revisionQueue: { findFirst: vi.fn(), create: vi.fn() },
    performanceRecord: { upsert: vi.fn(), findUnique: vi.fn() },
    dailyGoal: { findMany: vi.fn() },
    candidateExamTarget: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  cookie: vi.fn(),
}));
vi.mock("@/server/db", () => ({ prisma: mocks.db }));
vi.mock("@/server/env", () => ({ aiConfiguration: () => ({ enabled: mocks.enabled }) }));
vi.mock("@/server/ai/tasks", () => ({ fallbackFeedback: () => mocks.fallback, generateExamFeedback: mocks.generate }));
vi.mock("@/server/platform/candidate", () => ({ getCandidateExams: async () => [] }));
vi.mock("@/server/platform/achievements", () => ({ evaluateAchievements: vi.fn() }));
vi.mock("@/server/platform/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => mocks.background.push(fn) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireAuth: async () => ({ id: "candidate" }) }));

import { submitDailyExam } from "@/server/platform/daily-exam";
import { finishExamFeedback, isExamFeedbackPending } from "@/server/platform/exam-feedback";
import { getExamFeedbackStatus, setActiveExam } from "@/server/actions/platform";
import type { FeedbackInput } from "@/server/ai/tasks";

const feedbackInput: FeedbackInput = {
  examName: "Exam", level: "BEGINNER", totalQuestions: 1, correct: 1, incorrect: 0,
  unanswered: 0, accuracy: 100, scorePercent: 100, timeTakenSeconds: 60, durationMinutes: 180,
  weakestSubjects: [], weakestTopics: [], userId: "candidate", examId: "exam",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.background.length = 0;
  mocks.enabled = true;
  mocks.db.examAttempt.findFirst.mockResolvedValue({
    id: "attempt", status: "IN_PROGRESS", examId: "exam", dailyExamId: "daily",
    startedAt: new Date(Date.now() - 60_000), exam: { name: "Exam", code: "EXAM" },
    dailyExam: { questionIds: ["question"], configSnapshot: {}, durationMinutes: 180, scheduledDate: new Date(), slot: 0 },
  });
  mocks.db.question.findMany.mockResolvedValue([{
    id: "question", type: "SINGLE_CHOICE", subject: { id: "subject", name: "Physics" }, topic: { id: "topic", title: "Topic" },
    options: [{ id: "right", isCorrect: true }, { id: "wrong", isCorrect: false }],
  }]);
  mocks.db.questionExam.findMany.mockResolvedValue([{ questionId: "question", marks: 4, negativeMarks: 1 }]);
  mocks.db.syllabusTopic.findMany.mockResolvedValue([]);
  mocks.db.dailyGoal.findMany.mockResolvedValue([]);
  mocks.db.performanceRecord.findUnique.mockResolvedValue(null);
  mocks.db.examAttempt.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.$transaction.mockImplementation((fn: (tx: typeof mocks.db) => unknown) => fn(mocks.db));
  mocks.generate.mockResolvedValue({ feedback: mocks.fallback, aiGenerated: true });
});

describe("deferred exam feedback", () => {
  it("commits the score and fallback before starting AI work", async () => {
    expect(await submitDailyExam("candidate", "attempt", [{ questionId: "question", selected: ["right"] }])).toMatchObject({
      alreadySubmitted: false, correctCount: 1, scorePercent: 100,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.db.examAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt" },
      data: expect.objectContaining({ obtainedMarks: 4, totalMarks: 4, aiFeedback: { ...mocks.fallback, source: "PENDING" } }),
    });
    expect(mocks.background).toHaveLength(1);
    await mocks.background[0]();
    expect(mocks.db.examAttempt.update).toHaveBeenLastCalledWith({
      where: { id: "attempt" }, data: { aiFeedback: { ...mocks.fallback, source: "AI" } },
    });
  });

  it("preserves penalties and revision items for wrong answers", async () => {
    await submitDailyExam("candidate", "attempt", [{ questionId: "question", selected: ["wrong"] }]);
    expect(mocks.db.examAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ obtainedMarks: -1, negativeMarks: 1, incorrectCount: 1 }),
    }));
    expect(mocks.db.revisionQueue.create).toHaveBeenCalledTimes(1);
  });

  it("does not repeat feedback or scoring when a concurrent submission already committed", async () => {
    mocks.db.examAttempt.updateMany.mockResolvedValue({ count: 0 });
    expect(await submitDailyExam("candidate", "attempt", [])).toMatchObject({ alreadySubmitted: true });
    expect(mocks.db.examAttempt.update).not.toHaveBeenCalled();
    expect(mocks.background).toHaveLength(0);
  });

  it("keeps deterministic feedback if AI fails", async () => {
    mocks.generate.mockRejectedValue(new Error("provider unavailable"));
    await finishExamFeedback("attempt", feedbackInput);
    expect(mocks.db.examAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt" }, data: { aiFeedback: { ...mocks.fallback, source: "DETERMINISTIC" } },
    });
  });

  it("skips background work when AI is disabled", async () => {
    mocks.enabled = false;
    await submitDailyExam("candidate", "attempt", []);
    expect(mocks.background).toHaveLength(0);
  });

  it("stops waiting after a worker timeout and accepts legacy results", () => {
    expect(isExamFeedbackPending({ source: "PENDING" }, new Date())).toBe(true);
    expect(isExamFeedbackPending({ source: "PENDING" }, new Date(Date.now() - 61_000))).toBe(false);
    expect(isExamFeedbackPending(null, new Date())).toBe(false);
    expect(isExamFeedbackPending({ source: "AI" }, new Date())).toBe(false);
  });

  it("limits feedback status reads to the authenticated candidate", async () => {
    mocks.db.examAttempt.findFirst.mockResolvedValue(null);
    expect(await getExamFeedbackStatus("another-attempt")).toEqual({ pending: false });
    expect(mocks.db.examAttempt.findFirst).toHaveBeenCalledWith({
      where: { id: "another-attempt", userId: "candidate", status: "SUBMITTED" },
      select: { aiFeedback: true, submittedAt: true },
    });
  });
});

describe("exam switching", () => {
  it("validates the selected exam before setting its cookie", async () => {
    mocks.db.candidateExamTarget.findFirst.mockResolvedValue({ id: "target" });
    expect(await setActiveExam("NEET")).toEqual({ ok: true });
    expect(mocks.db.candidateExamTarget.findFirst).toHaveBeenCalledWith({
      where: { userId: "candidate", active: true, exam: { code: "NEET", active: true } }, select: { id: true },
    });
    expect(mocks.cookie).toHaveBeenCalledTimes(1);
  });

  it("rejects an exam outside the candidate's plan", async () => {
    mocks.db.candidateExamTarget.findFirst.mockResolvedValue(null);
    expect(await setActiveExam("NEET")).toMatchObject({ ok: false });
    expect(mocks.cookie).not.toHaveBeenCalled();
  });
});
