import { prisma } from "@/server/db";
import { computeStreak } from "./candidate";
import { notify } from "./notifications";

export type AchievementProgress = {
  code: string;
  title: string;
  description: string;
  icon: string;
  metric: string;
  threshold: number;
  xp: number;
  value: number;
  earned: boolean;
  earnedAt: Date | null;
};

export async function getAchievementProgress(userId: string) {
  const [definitions, awards, attempts, streak, syllabusTopics, perfectScores] = await Promise.all([
    prisma.achievementDefinition.findMany({ where: { active: true }, orderBy: [{ metric: "asc" }, { threshold: "asc" }] }),
    prisma.userAchievement.findMany({ where: { userId } }),
    prisma.examAttempt.aggregate({
      where: { userId, status: "SUBMITTED" },
      _count: { _all: true },
      _sum: { correctCount: true, incorrectCount: true },
    }),
    computeStreak(userId),
    prisma.topicProgress.count({ where: { userId, status: "COMPLETED" } }),
    prisma.examAttempt.count({ where: { userId, status: "SUBMITTED", incorrectCount: 0, unansweredCount: 0, correctCount: { gt: 0 } } }),
  ]);
  const correct = attempts._sum.correctCount ?? 0;
  const incorrect = attempts._sum.incorrectCount ?? 0;
  const accuracy = correct + incorrect ? Math.round((correct / (correct + incorrect)) * 1000) / 10 : 0;
  const metrics: Record<string, number> = {
    TESTS_COMPLETED: attempts._count._all,
    STREAK: streak,
    ACCURACY: accuracy,
    QUESTIONS_SOLVED: correct + incorrect,
    SYLLABUS_TOPICS: syllabusTopics,
    PERFECT_SCORE: perfectScores,
    MOCK_COMPLETED: 0,
  };
  const awardByCode = new Map(awards.map((award) => [award.achievementId, award]));
  const items: AchievementProgress[] = definitions.map((definition) => {
    const award = awardByCode.get(definition.id);
    return {
      code: definition.code,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      metric: definition.metric,
      threshold: definition.threshold,
      xp: definition.xp,
      value: metrics[definition.metric] ?? 0,
      earned: Boolean(award),
      earnedAt: award?.earnedAt ?? null,
    };
  });
  return { items, metrics, totalXp: awards.reduce((sum, award) => sum + (definitions.find((definition) => definition.id === award.achievementId)?.xp ?? 0), 0) };
}

export async function evaluateAchievements(userId: string) {
  const progress = await getAchievementProgress(userId);
  const newlyEarned: AchievementProgress[] = [];
  for (const item of progress.items) {
    if (item.earned || item.value < item.threshold) continue;
    const definition = await prisma.achievementDefinition.findUnique({ where: { code: item.code } });
    if (!definition) continue;
    try {
      await prisma.userAchievement.create({
        data: { userId, achievementId: definition.id, progress: item.value },
      });
      await notify(userId, "ACHIEVEMENT", `Achievement unlocked: ${definition.title}`, `${definition.description} You earned ${definition.xp} XP.`, "/app/achievements");
      newlyEarned.push({ ...item, earned: true, earnedAt: new Date() });
    } catch {
      // Another request may have awarded it first; the unique constraint protects us.
    }
  }
  return newlyEarned;
}
