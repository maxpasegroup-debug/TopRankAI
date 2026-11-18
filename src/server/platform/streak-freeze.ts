import { cache } from "react";
import { prisma } from "@/server/db";
import { PRO_FREEZES_PER_MONTH } from "@/shared/pro";
import { addDays, formatDate, todayDate } from "./utils";
import { freezeMonthKey, getProSubscription } from "./pro";
import { notify } from "./notifications";

export type FreezeState = {
  pro: boolean;
  allowance: number;
  used: number;
  remaining: number;
  frozenDates: { date: Date; createdAt: Date }[];
  yesterday: Date;
  canProtectYesterday: boolean;
  reason: string | null;
};

export const getFreezeState = cache(async (userId: string, examId: string): Promise<FreezeState> => {
  const today = todayDate();
  const yesterday = addDays(today, -1);
  const dayBefore = addDays(today, -2);
  const monthKey = freezeMonthKey();
  const [subscription, freezes, monthlyUsed, yesterdayPaper, dayBeforePaper] = await Promise.all([
    getProSubscription(userId),
    prisma.streakFreeze.findMany({
      where: { userId, examId },
      orderBy: { freezeDate: "desc" },
      select: { freezeDate: true, createdAt: true },
    }),
    prisma.streakFreeze.count({ where: { userId, monthKey } }),
    prisma.performanceRecord.findUnique({
      where: { userId_examId_recordDate: { userId, examId, recordDate: yesterday } },
      select: { testsAttended: true },
    }),
    prisma.performanceRecord.findUnique({
      where: { userId_examId_recordDate: { userId, examId, recordDate: dayBefore } },
      select: { testsAttended: true },
    }),
  ]);
  const used = monthlyUsed;
  const pro = Boolean(subscription);
  const alreadyProtected = freezes.some((item) => item.freezeDate.getTime() === yesterday.getTime());
  const missedYesterday = !yesterdayPaper || yesterdayPaper.testsAttended === 0;
  const activeDayBefore = Boolean(dayBeforePaper && dayBeforePaper.testsAttended > 0);
  const canProtectYesterday = pro && !alreadyProtected && used < PRO_FREEZES_PER_MONTH && missedYesterday && activeDayBefore;
  let reason: string | null = null;
  if (!pro) reason = "Streak freezes are part of Pro.";
  else if (alreadyProtected) reason = "Yesterday is already protected.";
  else if (!missedYesterday) reason = "Yesterday already has a submitted paper.";
  else if (used >= PRO_FREEZES_PER_MONTH) reason = `Both freezes for ${formatDate(today, { month: "long" })} are used.`;
  else if (!activeDayBefore) reason = "A freeze only helps when the day before yesterday was an active study day.";

  return {
    pro,
    allowance: PRO_FREEZES_PER_MONTH,
    used,
    remaining: Math.max(0, PRO_FREEZES_PER_MONTH - used),
    frozenDates: freezes
      .filter((item) => freezeMonthKey(item.freezeDate) === monthKey)
      .map((item) => ({ date: item.freezeDate, createdAt: item.createdAt })),
    yesterday,
    canProtectYesterday,
    reason: canProtectYesterday ? null : reason,
  };
});

export async function protectYesterday(userId: string, examId: string) {
  if (!(await getProSubscription(userId))) {
    throw new Error("Streak freezes are part of Pro. Choose a plan in Subscriptions first.");
  }
  const state = await getFreezeState(userId, examId);
  if (!state.canProtectYesterday) {
    throw new Error(state.reason ?? "Yesterday cannot be protected right now.");
  }
  const monthKey = freezeMonthKey();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const used = await tx.streakFreeze.count({ where: { userId, monthKey } });
    if (used >= PRO_FREEZES_PER_MONTH) throw new Error("Both freezes for this month are used.");
    await tx.streakFreeze.create({
      data: { userId, examId, freezeDate: state.yesterday, monthKey },
    });
  }, { timeout: 15000 });
  await notify(
    userId,
    "STREAK",
    "Streak protected",
    `${formatDate(state.yesterday, { day: "numeric", month: "short" })} is covered by a Pro streak freeze. Your streak keeps its count.`,
    "/app/planner",
  );
  return { date: state.yesterday, remaining: state.remaining - 1 };
}
