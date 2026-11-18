import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSubscription } from "@/server/platform/subscriptions";
import { getCandidateExams } from "@/server/platform/candidate";
import { mockMonthlyActive } from "@/shared/daily-workload";
import { MOCK_PLANS, formatPrice, type MockPlan } from "@/shared/subscriptions";
import { PRO_FEATURES } from "@/shared/pro";
import { SubscriptionCheckout } from "@/components/platform/app/SubscriptionCheckout";

export const metadata = { title: "Subscriptions" };
const date = (value: Date) => value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const monthlyTotal = MOCK_PLANS.MOCK_MONTHLY.amountPaise * 12;
const yearlySaving = monthlyTotal - MOCK_PLANS.MOCK_YEARLY.amountPaise;

const comparison: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Daily papers per exam", free: "1–4 · set by your level", pro: "Up to 8" },
  { label: "Official-pattern mocks and practice sets", free: true, pro: true },
  { label: "Custom tests by subject and difficulty", free: false, pro: "Up to 5 a day" },
  { label: "Weekly report card", free: false, pro: "Print or save as PDF" },
  { label: "Formula and mistake revision sheet", free: false, pro: true },
  { label: "Analytics", free: "Core report", pro: "Core + advanced" },
  { label: "Streak freezes", free: false, pro: "2 a month" },
  { label: "Learning centre, planner and revision queue", free: true, pro: true },
  { label: "AI-assisted notes and feedback", free: true, pro: true },
  { label: "Pro badge and renewal reminders", free: false, pro: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === "string") return <span className="tp-small">{value}</span>;
  return value
    ? <span className="tp-plan-yes" aria-label="Included"><Icon name="check" size={15} /></span>
    : <span className="tp-plan-no" aria-label="Not included">—</span>;
}

function paymentMethod(payment: { method: string | null; reference: string | null }) {
  if (payment.method === "CARD") return `Card •••• ${payment.reference ?? "—"}`;
  if (payment.method === "UPI") return payment.reference ?? "UPI";
  return "Card / UPI";
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
          <p>More papers, your own tests and the reports that turn practice into progress.</p>
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
            <p className="tp-small tp-muted" style={{ marginTop: 6, maxWidth: 660 }}>
              {active
                ? `Active until ${date(subscription!.endsAt!)}. Renew or switch below to add more time — extra days are added after your current expiry.`
                : "Your preparation level includes 1–4 daily papers for each exam, plus the full learning centre, planner, revision queue and core analytics. Pro adds more papers and the practice tools."}
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

      <section className="tp-pro-features tp-mt-24">
        <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 19 }}>What Pro adds</h2>
            <p className="tp-small tp-muted" style={{ marginTop: 4 }}>Six tools, all built on your real papers and answers.</p>
          </div>
          {active ? <span className="tp-pill tp-pill-ok"><Icon name="check" size={13} /> All included</span> : <span className="tp-pill">Available with Pro</span>}
        </div>
        <div className="tp-pro-feature-grid">
          {PRO_FEATURES.map((feature) => (
            <article className="tp-card tp-card-pad tp-pro-feature" key={feature.title}>
              <span className="tp-pro-feature-icon"><Icon name={feature.icon} size={18} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="tp-mt-28">
        <SubscriptionCheckout
          active={active}
          currentPlan={currentPlan}
          currentEndsAt={active ? subscription!.endsAt!.toISOString() : null}
          schedule={schedule}
          yearlySaving={yearlySaving}
          payer={{ name: user.name, email: user.email }}
        />
      </div>

      <section className="tp-card tp-card-pad tp-mt-24">
        <h2 style={{ fontSize: 19 }}>Compare plans</h2>
        <p className="tp-small tp-muted" style={{ marginTop: 4, marginBottom: 16 }}>
          Free keeps everything you use today. Pro adds more room and more feedback, never a different paper.
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
          Pro changes how much you can practise, never the marking. Scores, accuracy and streaks stay deterministic.
        </p>
      </section>

      <section className="tp-card tp-card-pad tp-mt-24">
        <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 4 }}>
          <h2 style={{ fontSize: 19 }}>Billing history</h2>
          {payments.length ? <span className="tp-pill">{payments.length}</span> : null}
        </div>
        {payments.length ? (
          <>
            <p className="tp-small tp-muted">Your latest {payments.length} checkout{payments.length === 1 ? "" : "s"}.</p>
            <div className="tp-mt-16">
              {payments.map((payment) => (
                <article className="tp-payment-history" key={payment.id}>
                  <div>
                    <strong>Pro {MOCK_PLANS[payment.plan as MockPlan]?.label ?? payment.plan}</strong>
                    <p className="tp-xs tp-muted">{date(payment.createdAt)} · {formatPrice(payment.amountPaise)} · {paymentMethod(payment)}</p>
                    {payment.endsAt ? <p className="tp-xs tp-muted">Access extended to {date(payment.endsAt)}</p> : null}
                    {payment.failureReason ? <p className="tp-xs" style={{ color: "var(--tp-danger)" }}>{payment.failureReason} Nothing was charged.</p> : null}
                    <p className="tp-xs tp-faint">Reference: {payment.id}</p>
                  </div>
                  <span className={`tp-pill ${payment.status === "SUCCESS" ? "tp-pill-ok" : "tp-pill-danger"}`}>{payment.status === "SUCCESS" ? "Paid" : "Declined"}</span>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="tp-empty" style={{ padding: "28px 16px 8px" }}>
            <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="landmark" /></span>
            <h3>No payments yet</h3>
            <p>Your receipts appear here after a plan is activated.</p>
          </div>
        )}
        <p className="tp-xs tp-faint" style={{ marginTop: 12 }}>No card details are stored and no automatic renewal is set up.</p>
      </section>
    </>
  );
}
