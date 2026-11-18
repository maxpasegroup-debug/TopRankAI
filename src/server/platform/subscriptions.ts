import { cache } from "react";
import { prisma } from "@/server/db";
import { renewalNotice } from "@/shared/subscriptions";

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
          title: notice === "expired" ? "Your mock Pro plan has expired" : "Your mock Pro plan expires soon",
          body: notice === "expired"
            ? "Your level's included paper allowance now applies. Renew in Subscriptions to restore extra papers. No automatic charge."
            : `Your extra papers expire on ${subscription.endsAt!.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. Renew in Subscriptions to keep Pro access. No automatic charge.`,
        }],
      });
    }
  }
  return subscription;
});
