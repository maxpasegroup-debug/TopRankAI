import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSubscription } from "@/server/platform/subscriptions";
import { getCandidateExams } from "@/server/platform/candidate";
import { aiUsageSummary } from "@/server/platform/ai-quota";
import { formatPrice, planLabel } from "@/shared/subscriptions";
import { AI_ALLOWANCE_ROWS, PLAN_LIST, isPaid, planForSubscription, type Plan } from "@/shared/plans";
import { SubscriptionCheckout } from "@/components/platform/app/SubscriptionCheckout";

export const metadata = { title: "Subscriptions" };
const date = (value: Date) => value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

type CellValue = string | boolean;
const comparison: { label: string; values: CellValue[] }[] = [
  { label: "Daily papers per exam", values: ["1–4 by level", "6", "8", "8 · priority"] },
  { label: "Custom tests per day", values: [false, "2", "5", "10"] },
  { label: "Official-pattern mocks and practice sets", values: [true, true, true, true] },
  { label: "Learning centre, planner and revision queue", values: [true, true, true, true] },
  { label: "Deterministic scoring and paper history", values: [true, true, true, true] },
  { label: "Advanced analytics", values: [false, true, true, true] },
  { label: "Report card and revision sheet", values: [false, true, true, true] },
  { label: "Weekly report card with previous week", values: [false, false, true, true] },
  { label: "Streak freezes per month", values: [false, "1", "2", "4"] },
  { label: "Unused AI credits carry over", values: [false, false, false, "1 month"] },
  { label: "Priority AI queue", values: [false, false, false, true] },
];

function Cell({ value }: { value: CellValue }) {
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

function allowanceText(value: number, unit: string) {
  if (value === 0) return "—";
  return unit === "day" ? `${value} a day` : `${value} a month`;
}

function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <span className={`tp-pro-badge ${plan.highlight ? "" : "tp-pro-badge-quiet"}`}>
      <Icon name={plan.icon} size={13} /> {plan.name}
    </span>
  );
}

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAuth();
  const [subscription, payments, exams, usage, params] = await Promise.all([
    getSubscription(user.id),
    prisma.mockPayment.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
    getCandidateExams(user.id),
    aiUsageSummary(user.id),
    searchParams,
  ]);
  const plan = planForSubscription(subscription);
  const active = isPaid(plan);
  const daysLeft = active && subscription?.endsAt ? Math.max(1, Math.ceil((subscription.endsAt.getTime() - Date.now()) / 86400000)) : 0;
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
          <p>Four monthly tiers. Every plan keeps the same papers and deterministic marking.</p>
        </div>
        {active
          ? <PlanBadge plan={plan} />
          : <span className="tp-pill">Aspirant plan</span>}
      </div>

      <section className={`tp-card tp-card-pad tp-plan-summary ${active ? "tp-plan-summary-pro" : ""}`}>
        <div className="tp-row-between tp-gap-20 tp-wrap">
          <div style={{ minWidth: 0 }}>
            <span className="tp-eyebrow">{active ? "Current plan" : "Included with your account"}</span>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>
              {plan.name}{active ? ` · ${formatPrice(plan.pricePaise)} a month` : ""}
            </h2>
            <p className="tp-small tp-muted" style={{ marginTop: 6, maxWidth: 660 }}>
              {active
                ? `Active until ${date(subscription!.endsAt!)}. Renew or change tier below — extra time is added after your current expiry.`
                : "Aspirant includes 1–4 daily papers for each exam, the full learning centre, planner, revision queue and core analytics. Riser and above add volume, reports and a larger AI allowance."}
            </p>
          </div>
          <div className="tp-row tp-gap-8 tp-wrap">
            {active
              ? <span className="tp-pill tp-pill-ok"><Icon name="clock" size={13} /> {daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>
              : <span className="tp-pill"><Icon name="layers" size={13} /> 1–4 papers a day included</span>}
            <Link className="tp-btn tp-btn-soft tp-btn-sm" href="/app/exams">Manage exams</Link>
          </div>
        </div>
        {usage.length ? (
          <div className="tp-row tp-gap-8 tp-wrap" style={{ marginTop: 16 }}>
            {usage.map((row) => (
              <span className="tp-pill" key={row.feature}>
                <Icon name="spark" size={12} /> {row.label}: {row.used}/{row.allowance} this month
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="tp-mt-24">
        <SubscriptionCheckout
          currentPlanId={plan.id}
          currentEndsAt={active && subscription?.endsAt ? subscription.endsAt.toISOString() : null}
          schedule={schedule}
          payer={{ name: user.name, email: user.email }}
        />
      </div>

      <section className="tp-card tp-card-pad tp-mt-24">
        <h2 style={{ fontSize: 19 }}>AI allowance</h2>
        <p className="tp-small tp-muted" style={{ marginTop: 4, marginBottom: 16 }}>
          Credits reset with your monthly plan. SIA doubts reset daily. Image, photo and voice tools are rolling out next.
        </p>
        <div className="tp-table-wrap" style={{ border: 0 }}>
          <table className="tp-table tp-plan-table">
            <thead>
              <tr>
                <th>AI tool</th>
                {PLAN_LIST.map((tier) => <th key={tier.id}>{tier.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {AI_ALLOWANCE_ROWS.map((row) => (
                <tr key={row.key}>
                  <th>{row.label}</th>
                  {PLAN_LIST.map((tier) => (
                    <td key={tier.id}>
                      {tier.limits.ai[row.key] === 0
                        ? <span className="tp-plan-no" aria-label="Not included">—</span>
                        : <span className="tp-small">{allowanceText(tier.limits.ai[row.key], row.unit)}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tp-card tp-card-pad tp-mt-24">
        <h2 style={{ fontSize: 19 }}>Compare plans</h2>
        <p className="tp-small tp-muted" style={{ marginTop: 4, marginBottom: 16 }}>
          Aspirant keeps everything you use today. Paid tiers add room to practise, reports and AI — never a different paper.
        </p>
        <div className="tp-table-wrap" style={{ border: 0 }}>
          <table className="tp-table tp-plan-table">
            <thead>
              <tr>
                <th>Feature</th>
                {PLAN_LIST.map((tier) => (
                  <th key={tier.id}>
                    <span className={tier.highlight ? "tp-plan-table-pro" : "tp-plan-table-head"}>
                      <Icon name={tier.highlight ? "crown" : tier.icon} size={13} /> {tier.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  {row.values.map((value, index) => <td key={PLAN_LIST[index].id}><Cell value={value} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tp-xs tp-faint" style={{ marginTop: 12 }}>
          A plan changes how much you can practise and how much AI help you get, never the marking. Scores, accuracy and streaks stay deterministic.
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
                    <strong>{planLabel(payment.plan)} · monthly</strong>
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
