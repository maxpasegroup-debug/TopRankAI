import { requireAuth } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSubscription } from "@/server/platform/subscriptions";
import { getCandidateExams } from "@/server/platform/candidate";
import { mockMonthlyActive } from "@/shared/daily-workload";
import { MOCK_PLANS, formatPrice, type MockPlan } from "@/shared/subscriptions";
import { SubscriptionCheckout } from "@/components/platform/app/SubscriptionCheckout";

export const metadata = { title: "Subscriptions" };
const date = (value: Date) => value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAuth();
  const [subscription, payments, exams, params] = await Promise.all([
    getSubscription(user.id),
    prisma.mockPayment.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    getCandidateExams(user.id), searchParams,
  ]);
  const active = mockMonthlyActive(subscription);
  const target = exams.find((exam) => exam.targetId === params.target);
  const count = Number(params.papers);
  const startMinutes = Number(params.start ?? target?.dailyStartMinutes ?? 480);
  const schedule = target && Number.isInteger(count) && count >= 1 && count <= 8 && Number.isInteger(startMinutes) && startMinutes >= 0 && startMinutes < 1440
    ? { targetId: target.targetId, name: target.name, count, startMinutes } : undefined;
  return <>
    <div className="tp-page-head"><div><div className="tp-eyebrow">Account · test billing</div><h1>Subscriptions</h1><p>More full papers, on your schedule. Every payment here is simulated.</p></div></div>
    <section className="tp-card tp-card-pad tp-mb-24">
      <div className="tp-row tp-gap-12 tp-wrap"><h2>{active ? "Pro is active" : "Free plan"}</h2><span className="tp-pill tp-pill-brand">{active ? `Pro · ${MOCK_PLANS[subscription!.plan as MockPlan].label} · mock` : "Included with your account"}</span></div>
      <p className="tp-muted tp-mt-16">{active ? `Access until ${date(subscription!.endsAt!)}. Renew manually to keep extra papers.` : "Your preparation level includes 1, 2, 3 or 4 daily papers. Pro unlocks extra papers above that allowance, up to 8 per exam."}</p>
      <p className="tp-small tp-faint tp-mt-16">Renewal reminders appear in Notifications when you visit the workspace within 7 days of expiry, and after expiry. At expiry your level's included allowance applies; your study history is kept.</p>
    </section>
    <SubscriptionCheckout active={active} schedule={schedule} />
    <section className="tp-card tp-card-pad tp-mt-24">
      <h2>Payment history</h2><p className="tp-small tp-muted">Your latest 50 mock attempts, including failed payments. Amounts below are simulated; nothing was charged.</p>
      {payments.length ? <div className="tp-stack tp-gap-12 tp-mt-16">{payments.map((payment) => <article className="tp-payment-history" key={payment.id}>
        <div><strong>Pro {MOCK_PLANS[payment.plan as MockPlan]?.label ?? payment.plan}</strong><p className="tp-xs tp-muted">{date(payment.createdAt)} · {formatPrice(payment.amountPaise)}</p><p className="tp-xs tp-faint">Reference: {payment.id}</p>{payment.endsAt ? <p className="tp-xs tp-muted">Access extended to {date(payment.endsAt)}</p> : null}</div>
        <span className={`tp-pill ${payment.status === "SUCCESS" ? "tp-pill-ok" : ""}`}>{payment.status === "SUCCESS" ? "Successful · mock" : "Failed · mock"}</span>
      </article>)}</div> : <p className="tp-muted tp-mt-16">No payments yet. Existing mock access is preserved; new checkout attempts will appear here.</p>}
    </section>
  </>;
}
