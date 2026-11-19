import { prisma } from "@/server/db";
import { getActivePlan, monthStart } from "./pro";
import type { AiAllowance, Plan } from "@/shared/plans";
import { isPaid } from "@/shared/plans";

/**
 * Monthly AI allowances. The AI helper already writes one AIUsageLog row per
 * call, so counting is a single indexed query per feature.
 */
export type AiFeature = "notes" | "feedback" | "plans";

const OPERATIONS: Record<AiFeature, string[]> = {
  notes: ["study_notes"],
  feedback: ["exam_feedback"],
  plans: ["study_plan"],
};

const LABELS: Record<AiFeature, string> = {
  notes: "AI topic notes",
  feedback: "AI exam feedback",
  plans: "AI study plans",
};

function allowanceFor(plan: Plan, feature: AiFeature) {
  const ai: AiAllowance = plan.limits.ai;
  if (feature === "notes") return ai.notesPerMonth;
  if (feature === "feedback") return ai.feedbackPerMonth;
  return ai.plansPerMonth;
}

export async function aiUsedThisMonth(userId: string, feature: AiFeature, now = new Date()) {
  return prisma.aIUsageLog.count({
    where: {
      userId,
      operation: { in: OPERATIONS[feature] },
      success: true,
      createdAt: { gte: monthStart(now) },
    },
  });
}

export async function aiRoom(userId: string, feature: AiFeature) {
  const { plan } = await getActivePlan(userId);
  const allowance = allowanceFor(plan, feature);
  const used = await aiUsedThisMonth(userId, feature);
  return { plan, allowance, used, remaining: Math.max(0, allowance - used), allowed: used < allowance };
}

/** Throws a user-facing message when this month's allowance is spent. */
export async function assertAiRoom(userId: string, feature: AiFeature) {
  const room = await aiRoom(userId, feature);
  if (room.allowed && room.allowance > 0) return room;
  if (!isPaid(room.plan)) {
    throw new Error(`${LABELS[feature]} is limited on Aspirant. Riser and above include a larger AI allowance.`);
  }
  throw new Error(`You have used this month's ${room.allowance} ${LABELS[feature].toLowerCase()}. The allowance resets on the 1st.`);
}

export type AiUsageRow = {
  feature: AiFeature;
  label: string;
  used: number;
  allowance: number;
};

/** Usage for the three AI tools that are live today, for the plan page. */
export async function aiUsageSummary(userId: string): Promise<AiUsageRow[]> {
  const { plan } = await getActivePlan(userId);
  const features: AiFeature[] = ["notes", "feedback", "plans"];
  const used = await Promise.all(features.map((feature) => aiUsedThisMonth(userId, feature)));
  return features.map((feature, index) => ({
    feature,
    label: LABELS[feature],
    used: used[index],
    allowance: allowanceFor(plan, feature),
  }));
}
