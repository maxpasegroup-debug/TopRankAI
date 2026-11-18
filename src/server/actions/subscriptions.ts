"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { mockMonthlyActive, MAX_DAILY_PAPERS } from "@/shared/daily-workload";
import { MOCK_PLANS, renewalEnd } from "@/shared/subscriptions";

const scheduleSchema = z.object({
  targetId: z.string().min(1),
  count: z.number().int().min(1).max(MAX_DAILY_PAPERS),
  startMinutes: z.number().int().min(0).max(1439),
});

const checkoutSchema = z.discriminatedUnion("method", [
  z.object({
    id: z.uuid(),
    plan: z.enum(["MOCK_MONTHLY", "MOCK_YEARLY"]),
    method: z.literal("CARD"),
    /** Only the last four digits ever leave the browser. */
    reference: z.string().regex(/^\d{4}$/),
    payerName: z.string().min(2).max(120),
    schedule: scheduleSchema.optional(),
  }),
  z.object({
    id: z.uuid(),
    plan: z.enum(["MOCK_MONTHLY", "MOCK_YEARLY"]),
    method: z.literal("UPI"),
    reference: z.string().min(3).max(120).regex(/^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/),
    payerName: z.string().min(2).max(120),
    schedule: scheduleSchema.optional(),
  }),
]);

/**
 * The outcome is decided on the server from the payment reference, never sent
 * by the client. The decline reference mirrors the well-known test card so the
 * failure path can be exercised without a real gateway.
 */
function isDeclined(method: "CARD" | "UPI", reference: string) {
  return method === "CARD" ? reference === "0002" : reference.toLowerCase().startsWith("fail");
}

export async function mockCheckout(raw: unknown) {
  const user = await requireAuth();
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check the payment details and try again." };
  const input = parsed.data;
  try {
    const payment = await prisma.$transaction(async (tx) => {
      // Serialize purchases for this account so retries and concurrent renewals cannot double-extend access.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const previous = await tx.mockPayment.findUnique({ where: { id: input.id } });
      if (previous) {
        if (previous.userId !== user.id) throw new Error("Checkout unavailable.");
        return previous;
      }
      const subscription = await tx.subscription.findUnique({ where: { userId: user.id } });
      if (subscription && !["FREE", "MOCK_MONTHLY", "MOCK_YEARLY"].includes(subscription.plan)) {
        throw new Error("Your existing plan cannot be replaced here.");
      }
      if (input.schedule && !await tx.candidateExamTarget.findFirst({ where: { id: input.schedule.targetId, userId: user.id, active: true, exam: { active: true } } })) {
        throw new Error("That exam is no longer active. Reopen Subscriptions from Daily exams.");
      }
      const declined = isDeclined(input.method, input.reference);
      const now = new Date();
      const endsAt = !declined
        ? renewalEnd(mockMonthlyActive(subscription, now) ? subscription!.endsAt! : now, MOCK_PLANS[input.plan].months)
        : null;
      const failureReason = declined
        ? input.method === "CARD"
          ? "The bank declined this card."
          : "The UPI mandate was rejected."
        : null;
      const row = await tx.mockPayment.create({
        data: {
          id: input.id,
          userId: user.id,
          plan: input.plan,
          amountPaise: MOCK_PLANS[input.plan].amountPaise,
          status: declined ? "FAILED" : "SUCCESS",
          method: input.method,
          reference: input.method === "CARD" ? input.reference : input.reference.toLowerCase(),
          payerName: input.payerName,
          failureReason,
          endsAt,
        },
      });
      if (endsAt) {
        const data = { plan: input.plan, status: "ACTIVE" as const, startsAt: mockMonthlyActive(subscription, now) ? subscription!.startsAt : now, endsAt, features: { mockPayment: true, maxDailyPapers: MAX_DAILY_PAPERS } };
        await tx.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
        if (input.schedule) await tx.candidateExamTarget.update({ where: { id: input.schedule.targetId }, data: { dailyPaperCount: input.schedule.count, dailyStartMinutes: input.schedule.startMinutes } });
      }
      await tx.notification.create({
        data: {
          userId: user.id,
          type: "SYSTEM",
          href: "/app/subscriptions",
          title: endsAt ? "Pro is now active" : "Payment declined",
          body: endsAt
            ? `Your plan runs until ${endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}. You can now schedule up to 8 papers a day and use every Pro tool.`
            : "Your plan was not changed and nothing was charged. Retry the payment from Subscriptions with another card or UPI ID.",
        },
      });
      return row;
    }, { timeout: 15000 });
    revalidatePath("/app", "layout");
    const endsAt = payment.endsAt ? payment.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : null;
    return {
      ok: payment.status === "SUCCESS",
      message: payment.status === "SUCCESS"
        ? `Payment successful. Pro is active until ${endsAt}.`
        : payment.failureReason ?? "The payment was declined. Your current access is unchanged.",
      paymentId: payment.id,
      endsAt,
    };
  } catch (error) {
    console.error("Checkout failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Checkout could not finish. Please try again." };
  }
}
