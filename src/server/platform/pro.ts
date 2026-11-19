import { cache } from "react";
import { prisma } from "@/server/db";
import { mockMonthlyActive } from "@/shared/daily-workload";
import { PLANS, isPaid, planForSubscription, type Plan } from "@/shared/plans";

export type ProSubscription = {
  plan: string;
  status: string;
  endsAt: Date | null;
};

/** Reads the subscription and returns it only while paid access is live. */
export const getProSubscription = cache(async (userId: string): Promise<ProSubscription | null> => {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return mockMonthlyActive(subscription) ? subscription! : null;
});

export async function hasPro(userId: string) {
  return Boolean(await getProSubscription(userId));
}

export type ActivePlan = {
  plan: Plan;
  active: boolean;
  subscription: ProSubscription | null;
};

/** The tier a user is on right now, falling back to Aspirant. */
export const getActivePlan = cache(async (userId: string): Promise<ActivePlan> => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, endsAt: true },
  });
  const live = mockMonthlyActive(subscription);
  return {
    plan: live ? planForSubscription(subscription) : PLANS.FREE,
    active: live,
    subscription: subscription ?? null,
  };
});

export async function assertPaidTier(userId: string, feature: string) {
  const { plan } = await getActivePlan(userId);
  if (!isPaid(plan)) {
    throw new Error(`${feature} is part of the paid plans. Choose Riser or above in Subscriptions.`);
  }
  return plan;
}

/** Calendar month key in the candidate's study timezone (YYYY-MM). */
export function freezeMonthKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

/** First instant of the current study month, for AI usage counting. */
export function monthStart(now = new Date()) {
  const key = freezeMonthKey(now);
  return new Date(`${key}-01T00:00:00+05:30`);
}
