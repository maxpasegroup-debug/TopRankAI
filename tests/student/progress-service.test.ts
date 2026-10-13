import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/server/auth/session";
const db = vi.hoisted(() => ({ studentProfile: { findUnique: vi.fn() }, studySession: { findMany: vi.fn() }, missionTask: { findMany: vi.fn() }, studentLessonProgress: { findMany: vi.fn() }, practiceAttempt: { findMany: vi.fn(), count: vi.fn() }, mockAttempt: { findMany: vi.fn(), count: vi.fn() } }));
const mocks = vi.hoisted(() => ({ activity: vi.fn(), guidance: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: db }));
vi.mock("@/server/journey/service", () => ({ getVerifiedProgress: mocks.activity }));
vi.mock("@/server/sia/service", () => ({ getSiaGuidance: mocks.guidance }));
import { getStudentEvidence } from "@/server/journey/progress";
const user: AuthUser = { id: "student", name: "Student", role: "STUDENT", email: "private@example.com" };
const now = new Date("2026-10-11T12:00:00Z");
beforeEach(() => {
  vi.resetAllMocks(); mocks.activity.mockResolvedValue({ completedTasks: 2, completedLessons: 1, recordedMinutes: 45, sessions: [], saved: [] }); mocks.guidance.mockResolvedValue({ source: "deterministic", href: "/home", externalProviderConnected: false });
  db.studentProfile.findUnique.mockResolvedValue({ dreamCollege: "My goal", targetYear: 2027, dailyStudyMins: 60, targetExam: { name: "Exam", code: "EXAM" } });
  for (const model of [db.studySession, db.missionTask, db.studentLessonProgress, db.practiceAttempt, db.mockAttempt]) model.findMany.mockResolvedValue([]);
  db.practiceAttempt.count.mockImplementation(async args => args.where.correct ? 3 : 5); db.mockAttempt.count.mockResolvedValue(1);
});
describe("consolidated private progress, mocked persistence", () => {
  it("preserves canonical activity and returns counts plus deterministic next action", async () => {
    const result = await getStudentEvidence(user, "Asia/Dubai", now);
    expect(result).toMatchObject({ completedTasks: 2, completedLessons: 1, totals: { practiceAttempts: 5, practiceCorrect: 3, finalizedMocks: 1 }, profile: { displayName: "Student" }, evidence: { timezone: "Asia/Dubai" } });
    expect(mocks.activity).toHaveBeenCalledWith(user); expect(mocks.guidance).toHaveBeenCalledWith(user, "Asia/Dubai", now); expect(JSON.stringify(result)).not.toContain(user.email);
  });
  it("scopes every evidence read and count to the authenticated identity", async () => {
    await getStudentEvidence(user, "UTC", now);
    for (const model of [db.studySession, db.studentLessonProgress, db.practiceAttempt, db.mockAttempt]) expect(model.findMany.mock.calls[0][0].where.userId).toBe(user.id);
    expect(db.missionTask.findMany.mock.calls[0][0].where.plan.userId).toBe(user.id); expect(db.studentProfile.findUnique.mock.calls[0][0].where.userId).toBe(user.id);
    for (const call of db.practiceAttempt.count.mock.calls) expect(call[0].where.userId).toBe(user.id); expect(db.mockAttempt.count.mock.calls[0][0].where.userId).toBe(user.id);
  });
  it("does not select practice answers or protected mock snapshots", async () => {
    await getStudentEvidence(user, "UTC", now);
    const practice = db.practiceAttempt.findMany.mock.calls[0][0].select, mock = db.mockAttempt.findMany.mock.calls[0][0].select;
    expect(practice).not.toHaveProperty("answer"); expect(practice).not.toHaveProperty("explanation"); expect(mock).not.toHaveProperty("snapshot"); expect(mock).not.toHaveProperty("answers");
  });
  it("reports bounded sampling rather than silently truncating", async () => {
    db.practiceAttempt.findMany.mockResolvedValue(Array.from({ length: 1001 }, (_, i) => ({ id: String(i), questionId: "q", correct: true, submittedAt: now, question: { subject: { id: "s", name: "Physics" } } })));
    const value = await getStudentEvidence(user, "UTC", now); expect(value.truncated.practice).toBe(true); expect(value.evidence.practice.attempts).toBe(1000); expect(value.evidence.practice.uniqueQuestions).toBe(1);
  });
  it("excludes invalid/finalization-incomplete mock metrics", async () => {
    db.mockAttempt.findMany.mockResolvedValue([{ id: "m", status: "EXPIRED", finalizedAt: now, result: null, mockExam: { title: "Mock" } }]);
    expect((await getStudentEvidence(user, "UTC", now)).evidence).toMatchObject({ invalidMockResults: 1, finalizedMocks: 0 });
  });
  it("does not finalize attempts or mutate progress on read", async () => { await getStudentEvidence(user, "UTC", now); expect(db.mockAttempt.findMany.mock.calls[0][0].where.status).toEqual({ not: "IN_PROGRESS" }); expect(Object.keys(db.mockAttempt)).not.toContain("update"); });
  it("handles a missing profile without inventing a target", async () => { db.studentProfile.findUnique.mockResolvedValue(null); expect((await getStudentEvidence(user, "UTC", now)).profile).toEqual({ displayName: "Student" }); });
  it("validates timezone before reads", async () => { await expect(getStudentEvidence(user, "invalid")).rejects.toThrow(); expect(mocks.activity).not.toHaveBeenCalled(); expect(db.studentProfile.findUnique).not.toHaveBeenCalled(); });
  it.each(["PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"] as const)("denies %s before reads", async role => { await expect(getStudentEvidence({ ...user, role })).rejects.toThrow(); expect(db.studentProfile.findUnique).not.toHaveBeenCalled(); });
});
