import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSubscription } from "@/server/platform/subscriptions";
import { getCandidateExams } from "@/server/platform/candidate";
import { mockMonthlyActive } from "@/shared/daily-workload";
import { MOCK_PLANS, formatPrice, type MockPlan } from "@/shared/subscriptions";
import { SubscriptionCheckout } from "@/components/platform/app/SubscriptionCheckout";

export const metadata = { title: "Subscriptions" };
const date = (value: Date) => value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const monthlyTotal = MOCK_PLANS.MOCK_MONTHLY.amountPaise * 12;
const yearlySaving = monthlyTotal - MOCK_PLANS.MOCK_YEARLY.amountPaise;

const comparison = [
  { label: "Daily papers per exam", free: "1–4, set by your level", pro: "Up to 8" },
  { label: "Full official-pattern mocks", free: "Within your daily allowance", pro: "More every day" },
  { label: "Every exam in your plan", free: true, pro: true },
  { label: "Practice sets from the reviewed bank", free: true, pro: true },
  { label: "Solutions, analytics and paper history", free: true, pro: true },
  { label: "Planner, revision queue and streaks", free: true, pro: true },
  { label: "AI-assisted notes and feedback", free: true, pro: true },
  { label: "Pro badge on your profile", free: false, pro: true },
  { label: "Renewal reminders", free: false, pro: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === "string") return <span className="tp-small">{value}</span>;
  return value
    ? <span className="tp-plan-yes" aria-label="Included"><Icon name="check" size={15} /></span>
    : <span className="tp-plan-no" aria-label="Not included">—</span>;
}

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAuth();
  const [subscription, payments, exams, params] = await Promise.all([
    getSubscription(user.id),
    prisma.mockPayment.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    getCandidateExams(user.id), searchParams,
  ]);
  const active = mockMonthlyActive(subscription);
  const currentPlan = active ? (subscription!.plan as MockPlan) : null;
  const daysLeft = active ? Math.max(1, Math.ceil((subscription!.endsAt!.getTime() - Date.now()) / 86400000)) : 0;
  const target = exams.find((exam) => exam.targetId === params.target);
  const count = Number(params.papers);
  const startMinutes = Number(params.start ?? target?.dailyStartMinutes ?? 480);
  const schedule = target && Number.isInteger(count) && count >= 1 && count <= 8 && Number.isInteger(startMinutes) && startMinutes >= 0 && startMinutes < 1440
    ? { targetId: target.targetId, name: target.name, count, startMinutes } : undefined;

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Account</div>
          <h1>Subscriptions</h1>
          <p>More full papers every day, with the same official pattern and deterministic scoring you already use.</p>
        </div>
        {active
          ? <span className="tp-pro-badge"><Icon name="crown" size={14} /> Pro {MOCK_PLANS[currentPlan!].label}</span>
          : <span className="tp-pill">Free plan</span>}
      </div>

      <section className={`tp-card tp-card-pad tp-plan-summary ${active ? "tp-plan-summary-pro" : ""}`}>
        <div className="tp-row-between tp-gap-20 tp-wrap">
          <div style={{ minWidth: 0 }}>
            <span className="tp-eyebrow">{active ? "Current plan" : "Included with your account"}</span>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>
              {active ? `Pro ${MOCK_PLANS[currentPlan!].label}` : "Free"}
            </h2>
            <p className="tp-small tp-muted" style={{ marginTop: 6, maxWidth: 640 }}>
              {active
                ? `Active until ${date(subscription!.endsAt!)}. Renew or switch below to add more time — extra days are added after your current expiry.`
                : "Your preparation level includes 1–4 daily papers for each exam, plus the full learning centre, planner, revision queue, analytics and paper history. Pro only raises the daily paper limit."}
            </p>
          </div>
          <div className="tp-row tp-gap-8 tp-wrap">
            {active
              ? <span className="tp-pill tp-pill-ok"><Icon name="clock" size={13} /> {daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>
              : <span className="tp-pill"><Icon name="layers" size={13} /> 1–4 papers a day included</span>}
            <Link className="tp-btn tp-btn-soft tp-btn-sm" href="/app/exams">Manage exams</Link>
          </div>
        </div>
      </section>

      <SubscriptionCheckout active={active} currentPlan={currentPlan} schedule={schedule} yearlySaving={yearlySaving} />

      <section className="tp-card tp-card-pad tp-mt-24">
        <h2 style={{ fontSize: 19 }}>Compare plans</h2>
        <p className="tp-small tp-muted" style={{ marginTop: 4, marginBottom: 16 }}>
          Free keeps everything you use today. Pro adds more papers, not a different paper.
        </p>
        <div className="tp-table-wrap" style={{ border: 0 }}>
          <table className="tp-table tp-plan-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th><span className="tp-plan-table-pro"><Icon name="crown" size={13} /> Pro</span></th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  <td><Cell value={row.free} /></td>
                  <td><Cell value={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tp-xs tp-faint" style={{ marginTop: 12 }}>
          Pro changes the number of papers you can run, never the marking. Scores, accuracy and streaks stay deterministic.
        </p>
      </section>

      {payments.length ? (
        <section className="tp-card tp-card-pad tp-mt-24">
          <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 4 }}>
            <h2 style={{ fontSize: 19 }}>Billing history</h2>
            <span className="tp-pill">{payments.length}</span>
          </div>
          <p className="tp-small tp-muted">Your latest {payments.length} checkout{payments.length === 1 ? "" : "s"}.</p>
          <div className="tp-mt-16">
            {payments.map((payment) => (
              <article className="tp-payment-history" key={payment.id}>
                <div>
                  <strong>Pro {MOCK_PLANS[payment.plan as MockPlan]?.label ?? payment.plan}</strong>
                  <p className="tp-xs tp-muted">{date(payment.createdAt)} · {formatPrice(payment.amountPaise)}</p>
                  {payment.endsAt ? <p className="tp-xs tp-muted">Access extended to {date(payment.endsAt)}</p> : null}
                  <p className="tp-xs tp-faint">Reference: {payment.id}</p>
                </div>
                <span className={`tp-pill ${payment.status === "SUCCESS" ? "tp-pill-ok" : ""}`}>{payment.status === "SUCCESS" ? "Paid" : "Failed"}</span>
              </article>
            ))}
          </div>
          <p className="tp-xs tp-faint" style={{ marginTop: 12 }}>No card details are stored and no automatic renewal is set up.</p>
        </section>
      ) : null}
    </>
  );
}
