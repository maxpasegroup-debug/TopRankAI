import { describe, expect, it } from "vitest";
import { summarizeEvidence, safeMockSummary, accuracy, type EvidenceRows } from "@/shared/progress-evidence";
const now = new Date("2026-10-11T12:00:00Z");
const empty = (): EvidenceRows => ({ sessions: [], missions: [], lessons: [], practice: [], mocks: [] });
const result = { score: "4", maximumScore: "8", total: 2, answered: 2, correct: 1, timeSeconds: 60 };
function attempt(id: string, correct: boolean, date = now, questionId = "q") { return { id, questionId, correct, submittedAt: date, question: { subject: { id: "s", name: "Physics" } } }; }
describe("evidence rollups, not mastery", () => {
  it("keeps empty accuracy unknown rather than fabricating success", () => {
    const value = summarizeEvidence(empty(), "UTC", now); expect(value.weeks).toHaveLength(4); expect(value.practice.accuracy).toBeNull(); expect(value.timeline).toEqual([]); expect(accuracy(0, 0)).toBeNull();
  });
  it("counts repeated submissions separately from distinct questions", () => {
    const rows = empty(); rows.practice = [attempt("a", false), attempt("b", true)];
    const value = summarizeEvidence(rows, "UTC", now); expect(value.practice).toEqual({ attempts: 2, uniqueQuestions: 1, accuracy: 50 }); expect(value.subjects[0]).toMatchObject({ attempts: 2, uniqueQuestions: 1, accuracy: 50 });
  });
  it("separates weekly accuracy with no inferred mastery", () => {
    const rows = empty(); rows.practice = [attempt("a", false, new Date("2026-09-15")), attempt("b", true)];
    const value = summarizeEvidence(rows, "UTC", now); expect(value.weeks[0].practiceAccuracy).toBe(0); expect(value.weeks[3].practiceAccuracy).toBe(100); expect(value).not.toHaveProperty("mastery");
  });
  it("excludes old/future records and unfinished sessions", () => {
    const rows = empty(); rows.practice = [attempt("old", true, new Date("2020-01-01")), attempt("future", true, new Date("2099-01-01"))]; rows.sessions = [{ id: "s", topic: "Open", startedAt: now, endedAt: null }]; expect(summarizeEvidence(rows, "UTC", now).practice.attempts).toBe(0);
  });
  it("clamps session minutes and uses completion/end timestamps", () => {
    const rows = empty(); rows.sessions = [{ id: "s", topic: "Study", startedAt: new Date("2026-10-09"), endedAt: now }]; rows.lessons = [{ lessonId: "l", lesson: { title: "Lesson" }, completedAt: now }]; rows.missions = [{ id: "m", title: "Mission", completedAt: now }];
    const value = summarizeEvidence(rows, "UTC", now); expect(value.recordedMinutes).toBe(720); expect(value.weeks[3]).toMatchObject({ missions: 1, lessons: 1 }); expect(value.timeline).toHaveLength(3);
  });
  it("handles India versus UAE calendar boundaries", () => {
    const edge = new Date("2026-10-10T19:00:00Z"); expect(summarizeEvidence(empty(), "Asia/Kolkata", edge).today).toBe("2026-10-11"); expect(summarizeEvidence(empty(), "Asia/Dubai", edge).today).toBe("2026-10-10");
  });
  it("uses only finalized validated mock aggregates, strips protected fields", () => {
    const rows = empty(); rows.mocks = [{ id: "m", status: "SUBMITTED", finalizedAt: now, mockExam: { title: "Mock" }, result: { ...result, outcomes: [{ numericalAnswer: "secret", isCorrect: true }], snapshot: "private" } }, { id: "active", status: "IN_PROGRESS", finalizedAt: now, mockExam: { title: "Active" }, result }];
    const value = summarizeEvidence(rows, "UTC", now); expect(value.finalizedMocks).toBe(1); expect(value.weeks[3].mockAccuracy).toBe(50); expect(JSON.stringify(value)).not.toMatch(/secret|numericalAnswer|isCorrect|snapshot|outcomes/);
  });
  it("reports invalid mock results instead of showing fabricated metrics", () => { const rows = empty(); rows.mocks = [{ id: "m", status: "EXPIRED", finalizedAt: now, mockExam: { title: "Bad" }, result: {} }]; expect(summarizeEvidence(rows, "UTC", now)).toMatchObject({ finalizedMocks: 0, invalidMockResults: 1 }); });
  it("bounds timeline and sorts most recent first", () => { const rows = empty(); rows.practice = Array.from({ length: 40 }, (_, i) => attempt(String(i), true, new Date(now.getTime() - i * 1000))); const value = summarizeEvidence(rows, "UTC", now); expect(value.timeline).toHaveLength(30); expect(value.timeline[0].id).toBe("practice:0"); });
  it("does not invent correct-answer keys from explanations", () => { expect(safeMockSummary({ ...result, explanation: "secret" })).toEqual({ ...result, score: 4, maximumScore: 8 }); });
  it.each([null, {}, { ...result, score: "NaN" }, { ...result, maximumScore: "0" }, { ...result, correct: 3 }, { ...result, answered: 3 }, { ...result, answered: -1 }, { ...result, total: 1.5 }, { ...result, score: Infinity }])("rejects invalid result %j", value => expect(safeMockSummary(value)).toBeNull());
});
