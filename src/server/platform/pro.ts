import { cache } from "react";
import { prisma } from "@/server/db";
import { mockMonthlyActive } from "@/shared/daily-workload";

export type ProSubscription = {
  plan: string;
  status: string;
  endsAt: Date | null;
};

/** Reads the subscription and returns it only while Pro access is live. */
export const getProSubscription = cache(async (userId: string): Promise<ProSubscription | null> => {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return mockMonthlyActive(subscription) ? subscription! : null;
});

export async function hasPro(userId: string) {
  return Boolean(await getProSubscription(userId));
}

/** Calendar month key in the candidate's study timezone (YYYY-MM). */
export function freezeMonthKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}
