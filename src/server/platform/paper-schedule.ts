import { prisma } from "@/server/db";
import { dailySchedule, EXAM_BREAK_MINUTES } from "@/shared/daily-workload";
import type { CandidateExam } from "./candidate";
import { formatDateTime, todayDate } from "./utils";

export async function getPaperSchedule(userId: string, exam: CandidateExam, day = todayDate()) {
  const [papers, lastSubmission] = await Promise.all([
    prisma.dailyExam.findMany({
      where: { userId, examId: exam.examId, scheduledDate: day },
      select: { slot: true, status: true, submittedAt: true, attempt: { select: { deadline: true } } },
    }),
    prisma.dailyExam.findFirst({
      where: { userId, examId: exam.examId, scheduledDate: { lt: day },
        submittedAt: { gt: new Date(Date.now() - EXAM_BREAK_MINUTES * 60_000) } },
      orderBy: { submittedAt: "desc" }, select: { submittedAt: true },
    }),
  ]);
  return dailySchedule(day, exam.papersPerDay, exam.durationMinutes, papers, lastSubmission?.submittedAt);
}

export async function checkPaperSlot(userId: string, exam: CandidateExam, slot: number, day: Date) {
  const schedule = await getPaperSchedule(userId, exam, day);
  const sitting = schedule[slot];
  if (!sitting) throw new Error("This paper is outside your daily plan.");
  if (slot && schedule[slot - 1].status !== "SUBMITTED") throw new Error("Submit the preceding paper to start your break.");
  if (!sitting.available) throw new Error(`Your next paper opens at ${formatDateTime(sitting.startsAt)} IST after a ${EXAM_BREAK_MINUTES}-minute break.`);
}
