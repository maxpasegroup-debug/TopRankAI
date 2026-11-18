"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { mockCheckout } from "@/server/actions/subscriptions";
import { MOCK_PLANS, formatPrice, type MockPlan } from "@/shared/subscriptions";

export function SubscriptionCheckout({ active, schedule }: {
  active: boolean;
  schedule?: { targetId: string; count: number; startMinutes: number; name: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<MockPlan>("MOCK_MONTHLY");
  const [id, setId] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string; paymentId?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function pay(outcome: "SUCCESS" | "FAILED") {
    startTransition(async () => {
      try {
        setResult(await mockCheckout({ id, plan, outcome, schedule }));
      } catch {
        setResult({ ok: false, message: "Connection interrupted. Retry this checkout to safely check the same payment; it will not extend your plan twice." });
      }
    });
  }

  return <>
    {schedule ? <div className="tp-note tp-mb-24">After a successful checkout, <strong>{schedule.name}</strong> will use <strong>{schedule.count} papers/day</strong> starting at {String(Math.floor(schedule.startMinutes / 60)).padStart(2, "0")}:{String(schedule.startMinutes % 60).padStart(2, "0")} IST. Your requested schedule is saved only on success.</div> : null}
    <div className="tp-subscription-plans">
      {Object.entries(MOCK_PLANS).map(([code, details]) => <section className="tp-card tp-card-pad" key={code}>
        <span className="tp-pill tp-pill-brand">Pro · {details.label}</span>
        <h2 style={{ marginTop: 16 }}>{formatPrice(details.amountPaise)}<span className="tp-small tp-muted"> / {code === "MOCK_MONTHLY" ? "month" : "year"}</span></h2>
        <p className="tp-small tp-muted">{code === "MOCK_YEARLY" ? "Save ₹589 compared with 12 monthly payments." : "One calendar month of extra-paper access."}</p>
        <ul className="tp-plan-features">
          <li>Choose up to 8 full papers per day for each selected exam.</li>
          <li>Same official paper format and marking rules as your daily exams.</li>
          <li>Flexible start times and the existing 45-minute breaks.</li>
          <li>Preparation level reflects your chosen paper count.</li>
          <li>Pro badge, payment history and in-app renewal reminders.</li>
        </ul>
        <button className="tp-btn tp-btn-block" onClick={() => {
          setPlan(code as MockPlan); setId(crypto.randomUUID()); setResult(null); dialog.current?.showModal();
        }}>{active ? "Renew" : "Choose"} {details.label.toLowerCase()}</button>
      </section>)}
    </div>
    <p className="tp-small tp-muted tp-mt-16">Test prices only. No gateway, bank details, real charges or automatic renewal. Renewing adds time after your current expiry, including when you switch billing periods. Existing learning, planner and review features stay available on Free.</p>
    <dialog ref={dialog} className="tp-payment-dialog" aria-labelledby="checkout-title" onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <div className="tp-row-between tp-gap-12">
        <h2 id="checkout-title">Mock checkout</h2>
        <button className="tp-btn tp-btn-ghost tp-btn-sm" aria-label="Close checkout" disabled={pending} onClick={() => dialog.current?.close()}>✕</button>
      </div>
      <p className="tp-muted tp-mt-16">Pro {MOCK_PLANS[plan].label} · {formatPrice(MOCK_PLANS[plan].amountPaise)}</p>
      <p className="tp-small tp-mt-16">This is a test payment. Choose an outcome below. No money will be charged.</p>
      {result ? <div className="tp-note tp-mt-16" role={result.ok ? "status" : "alert"}>
        <strong>{result.ok ? "Payment successful" : "Payment error"}</strong>
        <p>{result.message}</p>
        {result.paymentId ? <p className="tp-xs tp-faint">Reference: {result.paymentId}</p> : null}
      </div> : null}
      {result?.ok ? <div className="tp-stack tp-gap-12 tp-mt-24">
        <Link href="/app/daily" className="tp-btn" onClick={() => dialog.current?.close()}>Go to daily exams</Link>
        <button className="tp-btn tp-btn-ghost" onClick={() => dialog.current?.close()}>View subscription & history</button>
      </div> : <div className="tp-stack tp-gap-12 tp-mt-24">
        {result?.paymentId ? <button className="tp-btn" onClick={() => { setId(crypto.randomUUID()); setResult(null); }}>Try another mock payment</button> : <>
          <button className="tp-btn" disabled={pending} onClick={() => pay("SUCCESS")}>{pending ? "Processing…" : "Simulate successful payment"}</button>
          <button className="tp-btn tp-btn-ghost" disabled={pending} onClick={() => pay("FAILED")}>Simulate payment failure</button>
        </>}
      </div>}
    </dialog>
  </>;
}
