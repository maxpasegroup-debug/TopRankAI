import { cache } from "react";
import { prisma } from "@/server/db";
import { renewalNotice } from "@/shared/subscriptions";
import { planForSubscription } from "@/shared/plans";

const endsOn = (value: Date) => value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const getSubscription = cache(async (userId: string) => {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription && subscription.status === "ACTIVE") {
    const plan = planForSubscription(subscription);
    const notice = renewalNotice(subscription.endsAt);
    if (plan.code && notice) {
      await prisma.notification.createMany({
        skipDuplicates: true,
        data: [{
          id: `subscription:${subscription.id}:${subscription.endsAt!.getTime()}:${notice}`,
          userId, type: "SYSTEM", href: "/app/subscriptions",
          title: notice === "expired" ? `Your ${plan.name} plan has ended` : `Your ${plan.name} plan is ending soon`,
          body: notice === "expired"
            ? `Your included paper allowance now applies. Renew from Subscriptions to unlock up to ${plan.limits.dailyPapers} papers a day again.`
            : `${plan.name} access ends on ${endsOn(subscription.endsAt!)}. Renew from Subscriptions to keep up to ${plan.limits.dailyPapers} papers a day for each exam.`,
        }],
      });
    }
  }
  return subscription;
});
