import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { assertStudent } from "@/server/student/service";
import { getVerifiedProgress } from "./service";
import { timezoneSchema } from "./validation";
import { getSiaGuidance } from "@/server/sia/service";
import { calendarDay, shiftDay } from "@/shared/study-calendar";
import { summarizeEvidence } from "@/shared/progress-evidence";

export async function getStudentEvidence(user: AuthUser, timezoneValue = "Asia/Kolkata", now = new Date()) {
  assertStudent(user); const timezone = timezoneSchema.parse(timezoneValue);
  // One extra boundary day covers local calendar offsets; the rollup filters exactly.
  const since = new Date(shiftDay(calendarDay(now, timezone), -28));
  const [activity, profile, sessions, missions, lessons, practice, mocks, practiceTotal, practiceCorrect, mockTotal, guidance] = await Promise.all([
    getVerifiedProgress(user),
    prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { dreamCollege: true, targetYear: true, dailyStudyMins: true, targetExam: { select: { name: true, code: true } } } }),
    prisma.studySession.findMany({ where: { userId: user.id, endedAt: { gte: since, lte: now } }, orderBy: [{ endedAt: "desc" }, { id: "desc" }], take: 1001, select: { id: true, topic: true, startedAt: true, endedAt: true } }),
    prisma.missionTask.findMany({ where: { plan: { userId: user.id }, status: "COMPLETED", completedAt: { gte: since, lte: now } }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 1001, select: { id: true, title: true, completedAt: true } }),
    prisma.studentLessonProgress.findMany({ where: { userId: user.id, completedAt: { gte: since, lte: now } }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 1001, select: { lessonId: true, completedAt: true, lesson: { select: { title: true } } } }),
    prisma.practiceAttempt.findMany({ where: { userId: user.id, submittedAt: { gte: since, lte: now } }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 1001, select: { id: true, questionId: true, correct: true, submittedAt: true, question: { select: { subject: { select: { id: true, name: true } } } } } }),
    prisma.mockAttempt.findMany({ where: { userId: user.id, status: { not: "IN_PROGRESS" }, finalizedAt: { gte: since, lte: now } }, orderBy: [{ finalizedAt: "desc" }, { id: "desc" }], take: 101, select: { id: true, status: true, finalizedAt: true, result: true, mockExam: { select: { title: true } } } }),
    prisma.practiceAttempt.count({ where: { userId: user.id } }),
    prisma.practiceAttempt.count({ where: { userId: user.id, correct: true } }),
    prisma.mockAttempt.count({ where: { userId: user.id, status: { not: "IN_PROGRESS" } } }),
    getSiaGuidance(user, timezone, now),
  ]);
  const truncated = { sessions: sessions.length > 1000, missions: missions.length > 1000, lessons: lessons.length > 1000, practice: practice.length > 1000, mocks: mocks.length > 100 };
  return { ...activity, profile: { displayName: user.name, ...profile }, asOf: now.toISOString(), guidance,
    totals: { practiceAttempts: practiceTotal, practiceCorrect, finalizedMocks: mockTotal }, truncated,
    evidence: summarizeEvidence({ sessions: sessions.slice(0, 1000), missions: missions.slice(0, 1000), lessons: lessons.slice(0, 1000), practice: practice.slice(0, 1000), mocks: mocks.slice(0, 100) }, timezone, now) };
}
