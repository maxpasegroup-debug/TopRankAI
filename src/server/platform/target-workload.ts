import type { Prisma } from "@/generated/prisma/client";
import { ValidationApiError } from "@/server/api/errors";
import { includedPapers, levelForPapers, mockMonthlyActive, paperCount, type DailyLevel } from "@/shared/daily-workload";

// A target keeps its original allowance when it is reactivated or moved to a
// new year. Both exam-plan editors use the same subscription check.
export async function targetWorkload(tx: Prisma.TransactionClient, userId: string, examId: string, level: DailyLevel) {
  const prior = await tx.candidateExamTarget.findFirst({
    where: { userId, examId }, orderBy: [{ active: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { preparationLevel: true, dailyPaperCount: true,
      user: { select: { subscription: { select: { plan: true, status: true, endsAt: true } } } } },
  });
  if (!prior) return { preparationLevel: level, dailyPaperCount: null };
  const monthly = mockMonthlyActive(prior.user.subscription);
  const current = paperCount(prior.preparationLevel, prior.dailyPaperCount, monthly);
  const count = levelForPapers(current) === level ? current : includedPapers(level);
  if (!monthly && count > includedPapers(prior.preparationLevel)) {
    throw new ValidationApiError("Open Daily exams to activate mock monthly access for the extra papers.");
  }
  return { preparationLevel: prior.preparationLevel, dailyPaperCount: count };
}
