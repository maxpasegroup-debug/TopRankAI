import { z } from "zod";
import { calendarDay, shiftDay, recordedSessionMinutes } from "./study-calendar";

const count = z.number().int().nonnegative();
const decimal = z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).refine(Number.isFinite);
const mockSummary = z.object({ score: decimal, maximumScore: decimal.refine(v => v > 0), answered: count, correct: count, total: count, timeSeconds: count })
  .refine(v => v.correct <= v.answered && v.answered <= v.total && v.score <= v.maximumScore);
export function safeMockSummary(value: unknown) { const result = mockSummary.safeParse(value); return result.success ? result.data : null; }
export function accuracy(correct: number, attempts: number) { return Number.isInteger(correct) && Number.isInteger(attempts) && attempts > 0 && correct >= 0 && correct <= attempts ? Math.round(correct / attempts * 1000) / 10 : null; }
export type EvidenceRows = {
  sessions: { id: string; topic: string; startedAt: Date; endedAt: Date | null }[];
  missions: { id: string; title: string; completedAt: Date | null }[];
  lessons: { lessonId: string; completedAt: Date | null; lesson: { title: string } }[];
  practice: { id: string; questionId: string; submittedAt: Date; correct: boolean; question: { subject: { id: string; name: string } } }[];
  mocks: { id: string; status: string; finalizedAt: Date | null; result: unknown; mockExam: { title: string } }[];
};
export function summarizeEvidence(rows: EvidenceRows, timezone: string, now: Date) {
  const today = calendarDay(now, timezone), start = shiftDay(today, -27);
  const inWindow = (date: Date | null) => date && date <= now && calendarDay(date, timezone) >= start && calendarDay(date, timezone) <= today;
  const sessions = rows.sessions.filter(r => inWindow(r.endedAt));
  const missions = rows.missions.filter(r => inWindow(r.completedAt));
  const lessons = rows.lessons.filter(r => inWindow(r.completedAt));
  const practice = rows.practice.filter(r => inWindow(r.submittedAt));
  const finalized = rows.mocks.filter(r => r.status !== "IN_PROGRESS" && inWindow(r.finalizedAt));
  const mocks = finalized.flatMap(r => { const summary = safeMockSummary(r.result); return summary ? [{ id: r.id, title: r.mockExam.title, status: r.status, finalizedAt: r.finalizedAt!.toISOString(), ...summary }] : []; });
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const from = shiftDay(start, index * 7), to = shiftDay(from, 6);
    const belongs = (date: Date) => { const day = calendarDay(date, timezone); return day >= from && day <= to; };
    const attempts = practice.filter(r => belongs(r.submittedAt)), exams = mocks.filter(r => belongs(new Date(r.finalizedAt)));
    return { from, to, missions: missions.filter(r => belongs(r.completedAt!)).length, lessons: lessons.filter(r => belongs(r.completedAt!)).length,
      recordedMinutes: sessions.filter(r => belongs(r.endedAt!)).reduce((sum, r) => sum + recordedSessionMinutes(r.startedAt, r.endedAt!), 0),
      practiceAttempts: attempts.length, practiceAccuracy: accuracy(attempts.filter(r => r.correct).length, attempts.length),
      mocks: exams.length, mockAccuracy: accuracy(exams.reduce((sum, r) => sum + r.correct, 0), exams.reduce((sum, r) => sum + r.answered, 0)) };
  });
  const subjectMap = new Map<string, { id: string; name: string; attempts: number; correct: number; questions: Set<string> }>();
  for (const r of practice) { const s = r.question.subject; const value = subjectMap.get(s.id) ?? { ...s, attempts: 0, correct: 0, questions: new Set<string>() };
    value.attempts++; value.correct += Number(r.correct); value.questions.add(r.questionId); subjectMap.set(s.id, value); }
  const subjects = [...subjectMap.values()].map(s => ({ id: s.id, name: s.name, attempts: s.attempts, uniqueQuestions: s.questions.size, accuracy: accuracy(s.correct, s.attempts) })).sort((a, b) => b.attempts - a.attempts || a.id.localeCompare(b.id));
  const events = [
    ...missions.map(r => ({ id: `mission:${r.id}`, kind: "Mission completed", title: r.title, at: r.completedAt!.toISOString(), href: "/home" })),
    ...lessons.map(r => ({ id: `lesson:${r.lessonId}`, kind: "Lesson marked complete", title: r.lesson.title, at: r.completedAt!.toISOString(), href: "/learn/catalogue" })),
    ...sessions.map(r => ({ id: `session:${r.id}`, kind: "Study session recorded", title: r.topic, at: r.endedAt!.toISOString(), href: "/home" })),
    ...practice.map(r => ({ id: `practice:${r.id}`, kind: "Practice submitted", title: r.question.subject.name, at: r.submittedAt.toISOString(), href: "/practice/review" })),
    ...mocks.map(r => ({ id: `mock:${r.id}`, kind: r.status === "EXPIRED" ? "Mock expired" : "Mock submitted", title: r.title, at: r.finalizedAt, href: `/practice/mock-attempts?attemptId=${encodeURIComponent(r.id)}` })),
  ].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  return { start, today, timezone, weeks, subjects, mocks: mocks.slice(0, 10), timeline: events.slice(0, 30), invalidMockResults: finalized.length - mocks.length,
    practice: { attempts: practice.length, uniqueQuestions: new Set(practice.map(r => r.questionId)).size, accuracy: accuracy(practice.filter(r => r.correct).length, practice.length) },
    finalizedMocks: mocks.length, recordedMinutes: sessions.reduce((sum, r) => sum + recordedSessionMinutes(r.startedAt, r.endedAt!), 0) };
}
