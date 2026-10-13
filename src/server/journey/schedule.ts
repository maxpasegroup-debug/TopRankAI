import type { Prisma } from "@/generated/prisma/client";
import { ValidationApiError } from "@/server/api/errors";
import { calendarDay, shiftDay } from "@/shared/study-calendar";
export function assertFutureStudyDate(date: Date, timezone: string, now = new Date()) {
  const day = date.toISOString().slice(0, 10); const today = calendarDay(now, timezone);
  if (day < today || day > shiftDay(today, 365)) throw new ValidationApiError("Choose a study date between today and the next 365 days");
}
export async function assertDailyCapacity(tx: Prisma.TransactionClient, planId: string, budget: number, date: Date, minutes: number, excludeId?: string) {
  if (!Number.isInteger(budget) || budget < 30 || budget > 720) throw new ValidationApiError("Review your daily study budget before scheduling");
  const totals = await tx.missionTask.aggregate({ where: { planId, dueDate: date, status: { not: "SKIPPED" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, _sum: { minutes: true } });
  if ((totals._sum.minutes ?? 0) + minutes > budget) throw new ValidationApiError("This day exceeds your study budget. Shorten or move another mission first.");
}
export async function nextRevisionDate(tx: Prisma.TransactionClient, planId: string, budget: number, now = new Date()) {
  const today = calendarDay(now, "Asia/Kolkata");
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(shiftDay(today, offset));
    try { await assertDailyCapacity(tx, planId, budget, date, 15); return date; }
    catch (error) { if (!(error instanceof ValidationApiError)) throw error; }
  }
  throw new ValidationApiError("No room for revision in the next seven days. Shorten or move another mission first.");
}
