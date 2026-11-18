import { includedPapers, levelForPapers, MAX_DAILY_PAPERS, mockMonthlyActive, paperCount } from "@/shared/daily-workload";
import { cache } from "react";
import { prisma } from "@/server/db";
import { findExamPart, readExamPattern, type PatternPart } from "./patterns";
import { addDays, percent, todayDate, toNumber } from "./utils";
import { getUnreadNotificationCount } from "./notifications";

export type CandidateExam = {
  targetId: string;
  examId: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXTREME";
  papersPerDay: number;
  includedPapers: number;
  dailyStartMinutes: number;
  monthlyUntil: Date | null;
  targetYear: number;
  dailyMinutes: number;
  targetExamDate: Date | null;
  durationMinutes: number;
  dailyTestQuestions: number;
  dailyTestMinutes: number;
  positiveMarks: number;
  negativeMarks: number;
  totalQuestions: number;
  officialUrl: string | null;
  subjectCount: number;
  part: PatternPart | null;
  patternNote: string | null;
};

export const getCandidateExams = cache(async (userId: string): Promise<CandidateExam[]> => {
  const targets = await prisma.candidateExamTarget.findMany({
    where: { userId, active: true, exam: { active: true } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      user: { select: { subscription: { select: { plan: true, status: true, endsAt: true } } } },
      exam: {
        include: {
          configuration: true,
          examCategory: true,
          _count: { select: { examSubjects: true } },
        },
      },
    },
  });

  return targets.map((target) => {
    const subscription = target.user.subscription;
    const monthly = mockMonthlyActive(subscription);
    const pattern = readExamPattern(target.exam.configuration?.sections);
    const part = findExamPart(pattern, target.examPart);
    const duration = part?.durationMinutes ?? target.exam.configuration?.durationMinutes ?? 60;
    const count = Math.min(MAX_DAILY_PAPERS, paperCount(target.preparationLevel, target.dailyPaperCount, monthly));
    return {
      targetId: target.id,
      examId: target.examId,
      code: target.exam.code,
      name: target.exam.name,
      shortName: target.exam.shortName,
      category: target.exam.examCategory?.name ?? target.exam.category,
      level: levelForPapers(count),
      papersPerDay: count,
      includedPapers: includedPapers(target.preparationLevel),
      dailyStartMinutes: target.dailyStartMinutes,
      monthlyUntil: monthly ? subscription!.endsAt : null,
      targetYear: target.targetYear,
      dailyMinutes: target.dailyMinutes,
      targetExamDate: target.targetExamDate,
      durationMinutes: duration,
      dailyTestQuestions: target.exam.configuration?.dailyTestQuestions ?? 8,
      dailyTestMinutes: target.exam.configuration?.dailyTestMinutes ?? 12,
      positiveMarks: toNumber(target.exam.configuration?.positiveMarks ?? 4),
      negativeMarks: toNumber(target.exam.configuration?.negativeMarks ?? 1),
      totalQuestions: part?.totalQuestions ?? target.exam.configuration?.totalQuestions ?? 60,
      officialUrl: target.exam.officialUrl,
      subjectCount: target.exam._count.examSubjects,
      part,
      patternNote: pattern?.note ?? null,
    };
  });
});

export async function getSelectedExam(userId: string, code?: string | null): Promise<CandidateExam | null> {
  const exams = await getCandidateExams(userId);
  if (!exams.length) return null;
  if (code) return exams.find((exam) => exam.code.toLowerCase() === code.toLowerCase()) ?? exams[0];
  return exams[0];
}

export async function assertExamTarget(userId: string, examId: string) {
  const target = await prisma.candidateExamTarget.findFirst({
    where: { userId, examId, active: true },
    include: { exam: { include: { configuration: true } } },
  });
  if (!target) throw new Error("This exam is not part of your preparation plan.");
  return target;
}

export const computeStreak = cache(async (userId: string, examId?: string): Promise<number> => {
  const [records, freezes] = await Promise.all([
    prisma.performanceRecord.findMany({
      where: { userId, testsAttended: { gt: 0 }, ...(examId ? { examId } : {}) },
      orderBy: { recordDate: "desc" },
      take: 400,
      select: { recordDate: true },
    }),
    prisma.streakFreeze.findMany({
      where: { userId, ...(examId ? { examId } : {}) },
      select: { freezeDate: true },
    }),
  ]);
  if (!records.length) return 0;
  const days = new Set(records.map((record) => record.recordDate.toISOString().slice(0, 10)));
  const frozen = new Set(freezes.map((freeze) => freeze.freezeDate.toISOString().slice(0, 10)));
  const today = todayDate();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterdayKey = addDays(today, -1).toISOString().slice(0, 10);
  if (!days.has(todayKey) && !days.has(yesterdayKey) && !frozen.has(yesterdayKey)) return 0;
  let cursor = days.has(todayKey) ? today : addDays(today, -1);
  let streak = 0;
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) streak += 1;
    else if (!frozen.has(key)) break;
    cursor = addDays(cursor, -1);
    if (streak > 400) break;
  }
  return streak;
});

export const getSyllabusCompletion = cache(async (userId: string, examId: string) => {
  const [total, completed] = await Promise.all([
    prisma.syllabusTopic.count({ where: { active: true, chapter: { active: true, unit: { examId, active: true } } } }),
    prisma.topicProgress.count({
      where: { userId, status: "COMPLETED", topic: { chapter: { unit: { examId } } } },
    }),
  ]);
  return { total, completed, percent: percent(completed, total) };
});

export async function getDashboardData(userId: string, examCode?: string | null) {
  const exams = await getCandidateExams(userId);
  const selected = exams.find((exam) => examCode && exam.code.toLowerCase() === examCode.toLowerCase()) ?? exams[0] ?? null;
  const today = todayDate();

  if (!selected) {
    return { exams, selected: null, today, dailyExams: [], recentAttempts: [], streak: 0, streaks: [], revisionDue: 0, goals: [], unreadNotifications: 0, syllabus: { total: 0, completed: 0, percent: 0 }, nextEvent: null, achievements: { earned: 0, total: 0 }, performance: [] };
  }

  const [dailyExams, recentAttempts, streaks, revisionDue, goals, unreadNotifications, syllabus, nextEvent, earnedAchievements, totalAchievements, performance] = await Promise.all([
    prisma.dailyExam.findMany({
      where: { userId, examId: selected.examId, scheduledDate: today, slot: { lt: 1000 } },
      orderBy: { slot: "asc" },
      include: { attempt: { select: { id: true, status: true, obtainedMarks: true, totalMarks: true, accuracy: true } } },
    }),
    prisma.examAttempt.findMany({
      where: { userId, status: "SUBMITTED" },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 5,
      include: { exam: { select: { code: true, name: true } }, dailyExam: { select: { title: true, scheduledDate: true } } },
    }),
    Promise.all(
      exams.map(async (entry) => ({
        examId: entry.examId,
        label: entry.shortName ?? entry.name,
        streak: await computeStreak(userId, entry.examId),
      })),
    ),
    prisma.revisionQueue.count({ where: { userId, status: "PENDING", dueDate: { lte: today } } }),
    prisma.dailyGoal.findMany({ where: { userId, examId: selected.examId, goalDate: today }, orderBy: { order: "asc" } }),
    getUnreadNotificationCount(userId),
    getSyllabusCompletion(userId, selected.examId),
    prisma.examCalendar.findFirst({
      where: { examId: { in: exams.map((exam) => exam.examId) }, startDate: { gte: today }, status: { in: ["CONFIRMED", "TENTATIVE"] } },
      orderBy: { startDate: "asc" },
      include: { exam: { select: { code: true, name: true } } },
    }),
    prisma.userAchievement.count({ where: { userId } }),
    prisma.achievementDefinition.count({ where: { active: true } }),
    prisma.performanceRecord.findMany({ where: { userId, examId: selected.examId }, orderBy: { recordDate: "desc" }, take: 14 }),
  ]);

  return {
    exams,
    selected,
    today,
    dailyExams,
    recentAttempts,
    streak: streaks.find((entry) => entry.examId === selected.examId)?.streak ?? 0,
    streaks,
    revisionDue,
    goals,
    unreadNotifications,
    syllabus,
    nextEvent,
    achievements: { earned: earnedAchievements, total: totalAchievements },
    performance: performance.reverse(),
  };
}
