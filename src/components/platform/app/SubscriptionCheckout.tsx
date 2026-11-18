"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { mockCheckout } from "@/server/actions/subscriptions";
import { MOCK_PLANS, formatPrice, type MockPlan } from "@/shared/subscriptions";

type CheckoutResult = { ok: boolean; message: string; paymentId?: string } | null;

const planFeatures = [
  "Up to 8 full papers a day for every exam in your plan",
  "Extra official-pattern mocks beyond your level allowance",
  "Flexible start times with the built-in recovery breaks",
  "Full solutions, analytics, planner and revision queue",
  "Pro badge on your profile and renewal reminders",
];

export function SubscriptionCheckout({ active, currentPlan, schedule, yearlySaving }: {
  active: boolean;
  currentPlan: MockPlan | null;
  schedule?: { targetId: string; count: number; startMinutes: number; name: string };
  yearlySaving: number;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<MockPlan>(currentPlan ?? "MOCK_YEARLY");
  const [result, setResult] = useState<CheckoutResult>(null);
  const [pending, startTransition] = useTransition();

  function open(next: MockPlan) {
    setPlan(next);
    setResult(null);
    dialog.current?.showModal();
  }

  function close() {
    if (!pending) dialog.current?.close();
  }

  function activate() {
    const toastId = toast.loading("Activating your plan…");
    startTransition(async () => {
      try {
        const response = await mockCheckout({ id: crypto.randomUUID(), plan, outcome: "SUCCESS", schedule });
        setResult(response);
        if (response.ok) {
          toast.success("Pro is active. Your extra papers are unlocked.", { id: toastId });
          router.refresh();
        } else {
          toast.error(response.message, { id: toastId });
        }
      } catch {
        setResult({ ok: false, message: "Connection interrupted. Please try again." });
        toast.error("Connection interrupted. Please try again.", { id: toastId });
      }
    });
  }

  return (
    <section className="tp-mb-24">
      <div className="tp-row-between tp-gap-12 tp-wrap">
        <div>
          <h2 style={{ fontSize: 19 }}>Choose a plan</h2>
          <p className="tp-small tp-muted" style={{ marginTop: 4 }}>
            Same papers and scoring you already use — Pro simply lets you run more of them each day.
          </p>
        </div>
        {active ? <span className="tp-pill tp-pill-ok"><Icon name="crown" size={13} /> Pro active</span> : null}
      </div>

      {schedule ? (
        <div className="tp-note tp-mt-16">
          After activation, <strong>{schedule.name}</strong> will run <strong>{schedule.count} papers a day</strong> starting at{" "}
          {String(Math.floor(schedule.startMinutes / 60)).padStart(2, "0")}:{String(schedule.startMinutes % 60).padStart(2, "0")} IST.
          Your requested schedule is saved only when the plan is activated.
        </div>
      ) : null}

      <div className="tp-subscription-plans tp-mt-16">
        {Object.entries(MOCK_PLANS).map(([code, details]) => {
          const planCode = code as MockPlan;
          const yearly = planCode === "MOCK_YEARLY";
          return (
            <section className={`tp-card tp-card-pad tp-plan-card ${yearly ? "tp-plan-card-featured" : ""}`} key={code}>
              <div className="tp-row-between tp-gap-8 tp-wrap">
                <span className={`tp-pro-badge ${yearly ? "tp-pro-badge-gold" : ""}`}><Icon name="crown" size={13} /> Pro</span>
                {yearly
                  ? <span className="tp-pill tp-pill-ok">Save {formatPrice(yearlySaving)}</span>
                  : currentPlan === planCode ? <span className="tp-pill tp-pill-ok">Current plan</span> : null}
              </div>

              <h3 className="tp-plan-name">{details.label}</h3>
              <div className="tp-plan-price">
                {formatPrice(details.amountPaise)}
                <span>/ {yearly ? "year" : "month"}</span>
              </div>
              <p className="tp-small tp-muted">
                {yearly
                  ? `${formatPrice(Math.round(details.amountPaise / 12))} a month, billed once a year.`
                  : "A full month of extra papers across every exam in your plan."}
              </p>

              <ul className="tp-plan-features">
                {planFeatures.map((feature) => (
                  <li key={feature}><Icon name="check" size={14} /> <span>{feature}</span></li>
                ))}
              </ul>

              <button
                type="button"
                className={`tp-btn tp-btn-block ${yearly ? "tp-btn-accent" : ""}`}
                onClick={() => open(planCode)}
              >
                {active ? (currentPlan === planCode ? "Extend this plan" : "Switch and extend") : "Choose"} {details.label.toLowerCase()}
                <Icon name="arrow-right" size={15} />
              </button>
            </section>
          );
        })}
      </div>

      <p className="tp-small tp-muted tp-mt-16">
        Extra time is added after your current expiry. No card details are collected and no automatic renewal is set up.
      </p>

      <dialog ref={dialog} className="tp-payment-dialog" aria-labelledby="checkout-title" onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <div className="tp-row-between tp-gap-12">
          <h2 id="checkout-title" style={{ fontSize: 20 }}>{result?.ok ? "Pro activated" : `Activate Pro ${MOCK_PLANS[plan].label}`}</h2>
          <button className="tp-btn tp-btn-ghost tp-btn-sm" aria-label="Close" disabled={pending} onClick={close}>
            <Icon name="x" size={15} />
          </button>
        </div>

        {result?.ok ? (
          <div className="tp-stack tp-gap-16 tp-mt-16">
            <span className="tp-pro-badge"><Icon name="crown" size={14} /> Pro {MOCK_PLANS[plan].label}</span>
            <p className="tp-small tp-muted">{result.message}</p>
            <div className="tp-stack tp-gap-10">
              <Link href="/app/daily" className="tp-btn" onClick={close}>Start a paper</Link>
              <button type="button" className="tp-btn tp-btn-ghost" onClick={close}>Stay on subscriptions</button>
            </div>
          </div>
        ) : (
          <>
            <div className="tp-row-between tp-gap-12 tp-mt-16">
              <span className="tp-small tp-muted">Pro {MOCK_PLANS[plan].label}</span>
              <strong>{formatPrice(MOCK_PLANS[plan].amountPaise)}</strong>
            </div>
            <ul className="tp-plan-features tp-plan-features-compact">
              <li><Icon name="check" size={14} /> <span>Up to 8 papers a day for each exam</span></li>
              <li><Icon name="check" size={14} /> <span>All your existing study tools stay available</span></li>
              <li><Icon name="check" size={14} /> <span>Pro badge and renewal reminders</span></li>
            </ul>
            <p className="tp-xs tp-faint">Plan access begins immediately and runs until the same date next {plan === "MOCK_YEARLY" ? "year" : "month"}.</p>
            {result && !result.ok ? <p className="tp-small" role="alert" style={{ color: "var(--tp-danger)" }}>{result.message}</p> : null}
            <div className="tp-row tp-gap-10 tp-wrap tp-mt-16">
              <button type="button" className="tp-btn" disabled={pending} onClick={activate}>
                {pending ? "Activating…" : `Activate ${MOCK_PLANS[plan].label.toLowerCase()}`}
                {pending ? null : <Icon name="crown" size={15} />}
              </button>
              <button type="button" className="tp-btn tp-btn-ghost" disabled={pending} onClick={close}>Cancel</button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
