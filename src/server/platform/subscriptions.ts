import { cache } from "react";
import { prisma } from "@/server/db";
import { renewalNotice } from "@/shared/subscriptions";

const endsOn = (value: Date) => value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const getSubscription = cache(async (userId: string) => {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription && ["MOCK_MONTHLY", "MOCK_YEARLY"].includes(subscription.plan) && subscription.status === "ACTIVE") {
    const notice = renewalNotice(subscription.endsAt);
    if (notice) {
      await prisma.notification.createMany({
        skipDuplicates: true,
        data: [{
          id: `subscription:${subscription.id}:${subscription.endsAt!.getTime()}:${notice}`,
          userId, type: "SYSTEM", href: "/app/subscriptions",
          title: notice === "expired" ? "Your Pro plan has ended" : "Your Pro plan is ending soon",
          body: notice === "expired"
            ? `Your included paper allowance now applies. Renew from Subscriptions to unlock up to 8 papers a day again.`
            : `Pro access ends on ${endsOn(subscription.endsAt!)}. Renew from Subscriptions to keep up to 8 papers a day for each exam.`,
        }],
      });
    }
  }
  return subscription;
});
