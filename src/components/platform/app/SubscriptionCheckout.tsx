"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { mockCheckout } from "@/server/actions/subscriptions";
import { MOCK_PLANS, formatPrice, renewalEnd, type MockPlan } from "@/shared/subscriptions";
import { PLANS, PLAN_LIST, isPaid, type PlanId } from "@/shared/plans";

type Stage = "form" | "processing" | "success" | "failed";
type Method = "CARD" | "UPI";
type Result = { ok: boolean; message: string; paymentId?: string; endsAt?: string | null } | null;

const paidEntries = Object.entries(MOCK_PLANS) as [MockPlan, (typeof MOCK_PLANS)[MockPlan]][];
const planCodeFor = (id: PlanId): MockPlan => (id === "RISER" ? "RISER_MONTHLY" : id === "TOPPER" ? "TOPPER_MONTHLY" : "SCHOLAR_MONTHLY");

function luhn(digits: string) {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function cardBrand(digits: string) {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  if (/^(60|65|81|82|508)/.test(digits)) return "RuPay";
  return digits ? "Card" : "";
}

function expiryIsFuture(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const end = new Date(year, month, 1);
  return end.getTime() > Date.now();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function SubscriptionCheckout({ currentPlanId, currentEndsAt, schedule, payer }: {
  currentPlanId: PlanId;
  currentEndsAt?: string | null;
  schedule?: { targetId: string; count: number; startMinutes: number; name: string };
  payer: { name: string; email: string };
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<MockPlan>(planCodeFor(currentPlanId));
  const [stage, setStage] = useState<Stage>("form");
  const [method, setMethod] = useState<Method>("CARD");
  const [result, setResult] = useState<Result>(null);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [holder, setHolder] = useState(payer.name);
  const [email, setEmail] = useState(payer.email);
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [upi, setUpi] = useState("");

  const digits = card.replace(/\D/g, "");
  const brand = cardBrand(digits);
  const price = formatPrice(MOCK_PLANS[plan].amountPaise);
  const planId = plan === "RISER_MONTHLY" ? "RISER" : plan === "TOPPER_MONTHLY" ? "TOPPER" : "SCHOLAR";
  const planName = PLANS[planId].name;
  const cap = PLANS[planId].limits.dailyPapers;
  const requestedCount = schedule?.count ?? 0;
  const scheduleCount = requestedCount > cap ? cap : requestedCount;
  const projectedEnd = useMemo(() => renewalEnd(currentEndsAt ? new Date(currentEndsAt) : new Date(), 1), [currentEndsAt]);

  useEffect(() => {
    if (stage !== "processing") return;
    setStep(0);
    const first = setTimeout(() => setStep(1), 750);
    const second = setTimeout(() => setStep(2), 1550);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [stage]);

  function open(next: MockPlan) {
    setPlan(next);
    setStage("form");
    setResult(null);
    setErrors({});
    setMethod("CARD");
    setCard("");
    setExpiry("");
    setCvv("");
    setUpi("");
    setStep(0);
    dialog.current?.showModal();
  }

  function close() {
    if (pending || stage === "processing") return;
    setCard("");
    setExpiry("");
    setCvv("");
    setUpi("");
    dialog.current?.close();
  }

  function validate() {
    const next: Record<string, string> = {};
    if (holder.trim().length < 3) next.holder = "Enter the name on the payment method.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = "Enter a valid email for the receipt.";
    if (method === "CARD") {
      if (digits.length < 13 || digits.length > 19 || !luhn(digits)) next.card = "Enter a valid card number.";
      if (!expiryIsFuture(expiry)) next.expiry = "Use a future expiry date in MM/YY format.";
      if (!/^\d{3,4}$/.test(cvv)) next.cvv = "CVV must be 3 or 4 digits.";
    } else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/.test(upi.trim())) {
      next.upi = "Enter a UPI ID like name@bank.";
    }
    return next;
  }

  function pay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length) {
      toast.error("Check the highlighted payment details.");
      return;
    }
    setStage("processing");
    const reference = method === "CARD" ? digits.slice(-4) : upi.trim();
    startTransition(async () => {
      try {
        const [response] = await Promise.all([
          mockCheckout({
            id: crypto.randomUUID(),
            plan,
            method,
            reference,
            payerName: holder.trim(),
            schedule: schedule ? { ...schedule, count: scheduleCount } : undefined,
          }),
          wait(2300),
        ]);
        setResult(response);
        if (response.ok) {
          setStage("success");
          toast.success(`Payment successful. ${planName} is active.`);
          router.refresh();
        } else {
          setStage("failed");
          toast.error(response.message);
        }
      } catch {
        setResult({ ok: false, message: "The connection dropped before the payment finished. Nothing was charged — please retry." });
        setStage("failed");
        toast.error("The connection dropped. Please retry.");
      }
    });
  }

  function retry() {
    setStage("form");
    setResult(null);
    setCvv("");
    setErrors({});
  }

  return (
    <section className="tp-mb-24">
      <div className="tp-row-between tp-gap-12 tp-wrap">
        <div>
          <h2 style={{ fontSize: 19 }}>Choose a plan</h2>
          <p className="tp-small tp-muted" style={{ marginTop: 4 }}>
            Every plan keeps the same papers and deterministic marking. Higher tiers add volume, reports and AI allowance.
          </p>
        </div>
        {isPaid(currentPlanId) ? (
          <span className="tp-pill tp-pill-ok"><Icon name="crown" size={13} /> {PLANS[currentPlanId].name} active</span>
        ) : null}
      </div>

      {schedule ? (
        <div className="tp-note tp-mt-16">
          After activation, <strong>{schedule.name}</strong> will run <strong>{scheduleCount} paper{scheduleCount === 1 ? "" : "s"} a day</strong> starting at{" "}
          {String(Math.floor(schedule.startMinutes / 60)).padStart(2, "0")}:{String(schedule.startMinutes % 60).padStart(2, "0")} IST.
          {requestedCount > cap ? ` ${planName} tops out at ${cap} papers a day.` : ""} Your requested schedule is saved only when the plan is activated.
        </div>
      ) : null}

      <div className="tp-subscription-plans tp-mt-16">
        {PLAN_LIST.map((tier) => {
          const isCurrent = tier.id === currentPlanId;
          const paid = isPaid(tier);
          return (
            <section className={`tp-card tp-card-pad tp-plan-card ${tier.highlight ? "tp-plan-card-featured" : ""}`} key={tier.id}>
              <div className="tp-row-between tp-gap-8 tp-wrap">
                <span className={`tp-pro-badge ${tier.highlight ? "" : "tp-pro-badge-quiet"}`}>
                  <Icon name={tier.icon} size={13} /> {tier.name}
                </span>
                {isCurrent ? <span className="tp-pill tp-pill-ok">Current plan</span> : null}
              </div>

              <h3 className="tp-plan-name">{tier.name}</h3>
              <div className="tp-plan-price">
                {formatPrice(tier.pricePaise)}
                <span>/ {paid ? "month" : "forever"}</span>
              </div>
              <p className="tp-small tp-muted">{tier.tagline}</p>

              <ul className="tp-plan-features">
                {tier.points.map((point) => (
                  <li key={point}><Icon name="check" size={14} /> <span>{point}</span></li>
                ))}
              </ul>

              {paid ? (
                <button type="button" className={`tp-btn tp-btn-block ${tier.highlight ? "tp-btn-accent" : ""}`} onClick={() => open(tier.code!)}>
                  {isCurrent ? `Extend ${tier.name}` : `Choose ${tier.name}`}
                  <Icon name="arrow-right" size={15} />
                </button>
              ) : (
                <span className="tp-btn tp-btn-block tp-btn-ghost" aria-disabled="true" style={{ cursor: "default" }}>
                  Included with your account
                </span>
              )}
            </section>
          );
        })}
      </div>

      <p className="tp-xs tp-faint tp-mt-16" style={{ margin: 0 }}>
        Plans are monthly and renew manually. Extra time is added after your current expiry.
      </p>

      <dialog
        ref={dialog}
        className="tp-checkout"
        aria-labelledby="checkout-title"
        onCancel={(event) => { if (pending || stage === "processing") event.preventDefault(); }}
        onClose={() => { if (stage !== "success") { setStage("form"); setResult(null); } }}
      >
        <div className="tp-checkout-head">
          <div className="tp-row tp-gap-10">
            <span className="tp-checkout-lock"><Icon name="lock" size={16} /></span>
            <div>
              <strong id="checkout-title">Secure checkout</strong>
              <div className="tp-xs tp-faint">{planName} · {price} a month</div>
            </div>
          </div>
          <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" aria-label="Close checkout" disabled={pending || stage === "processing"} onClick={close}>
            <Icon name="x" size={15} />
          </button>
        </div>

        {stage === "success" ? (
          <div className="tp-pay-result tp-pay-success" role="status">
            <div className="tp-pay-mark">
              <svg viewBox="0 0 52 52" aria-hidden="true">
                <circle cx="26" cy="26" r="23" />
                <path d="M15 27l7 7 15-16" />
              </svg>
              {[0, 1, 2, 3, 4, 5].map((spark) => <span key={spark} style={{ ["--spark" as string]: spark }} />)}
            </div>
            <h2>Payment successful</h2>
            <p className="tp-small tp-muted">
              {result?.message ?? `${planName} is active.`} Your receipt is in Billing history.
            </p>
            <div className="tp-pay-receipt">
              <div><span>Plan</span><strong>{planName} · monthly</strong></div>
              <div><span>Paid</span><strong>{price}</strong></div>
              <div><span>Method</span><strong>{method === "CARD" ? `${brand} •••• ${digits.slice(-4)}` : upi}</strong></div>
              <div><span>Valid until</span><strong>{result?.endsAt ?? projectedEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong></div>
            </div>
            <div className="tp-pay-actions">
              <Link href="/app/daily" className="tp-btn" onClick={close}>Start a paper <Icon name="arrow-right" size={15} /></Link>
              <button type="button" className="tp-btn tp-btn-ghost" onClick={close}>Done</button>
            </div>
          </div>
        ) : stage === "failed" ? (
          <div className="tp-pay-result tp-pay-failed" role="alert">
            <div className="tp-pay-mark">
              <svg viewBox="0 0 52 52" aria-hidden="true">
                <circle cx="26" cy="26" r="23" />
                <path d="M18 18l16 16M34 18L18 34" />
              </svg>
            </div>
            <h2>Payment declined</h2>
            <p className="tp-small tp-muted">{result?.message ?? "The payment could not be completed."}</p>
            <div className="tp-pay-receipt">
              <div><span>Plan</span><strong>{planName} · monthly</strong></div>
              <div><span>Charged</span><strong>{formatPrice(0)}</strong></div>
              <div><span>Method</span><strong>{method === "CARD" ? `${brand || "Card"} •••• ${digits.slice(-4) || "—"}` : upi}</strong></div>
            </div>
            <div className="tp-pay-actions">
              <button type="button" className="tp-btn" onClick={retry}><Icon name="refresh" size={15} /> Try again</button>
              <button type="button" className="tp-btn tp-btn-ghost" onClick={close}>Close</button>
            </div>
            <p className="tp-xs tp-faint">Nothing was charged. Your current access is unchanged.</p>
          </div>
        ) : (
          <div className="tp-checkout-grid">
            <aside className="tp-checkout-summary">
              <div>
                <span className="tp-eyebrow">Order summary</span>
                <div className="tp-checkout-plan">
                  <span className="tp-pro-badge"><Icon name={PLANS[planId].icon} size={13} /> {planName}</span>
                  <div className="tp-checkout-tabs">
                    {paidEntries.map(([code, details]) => (
                      <button
                        key={code}
                        type="button"
                        className="tp-checkout-tab"
                        data-active={plan === code}
                        disabled={pending}
                        onClick={() => { setPlan(code); setResult(null); setErrors({}); }}
                      >
                        {details.label}
                      </button>
                    ))}
                  </div>
                </div>
                <h3 className="tp-plan-price" style={{ fontSize: 30 }}>{price}<span>/ month</span></h3>
                <p className="tp-xs tp-muted">
                  {isPaid(currentPlanId)
                    ? `Added after your current expiry. Cover extends to about ${projectedEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
                    : `Access begins immediately and runs to about ${projectedEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`}
                </p>
              </div>
              <ul className="tp-plan-features tp-plan-features-compact">
                {PLANS[planId].points.map((point) => (
                  <li key={point}><Icon name="check" size={14} /> <span>{point}</span></li>
                ))}
              </ul>
              <p className="tp-xs tp-faint" style={{ margin: 0 }}>No card details are stored and there is no automatic renewal.</p>
            </aside>

            <form className="tp-checkout-form" onSubmit={pay} noValidate>
              {stage === "processing" ? (
                <div className="tp-pay-processing" role="status" aria-live="polite">
                  <div className="tp-pay-pulse"><span /><span /><span /><Icon name="lock" size={22} /></div>
                  <h3>Processing payment</h3>
                  <ol className="tp-pay-steps" data-step={step}>
                    <li data-done={step > 0} data-active={step === 0}>Contacting your bank</li>
                    <li data-done={step > 1} data-active={step === 1}>Verifying the payment</li>
                    <li data-active={step === 2}>Activating {planName}</li>
                  </ol>
                  <p className="tp-xs tp-faint">Keep this window open. It takes a few seconds.</p>
                </div>
              ) : null}

              <div className="tp-pay-methods" role="tablist" aria-label="Payment method">
                <button type="button" role="tab" aria-selected={method === "CARD"} data-active={method === "CARD"} className="tp-pay-method" onClick={() => { setMethod("CARD"); setErrors({}); }} disabled={pending}>
                  <Icon name="landmark" size={16} /> Card
                </button>
                <button type="button" role="tab" aria-selected={method === "UPI"} data-active={method === "UPI"} className="tp-pay-method" onClick={() => { setMethod("UPI"); setErrors({}); }} disabled={pending}>
                  <Icon name="phone" size={16} /> UPI
                </button>
              </div>

              <label className="tp-label" htmlFor="pay-name">Name on payment method</label>
              <input
                id="pay-name"
                className="tp-input"
                value={holder}
                onChange={(event) => setHolder(event.target.value)}
                autoComplete="name"
                disabled={pending}
                aria-invalid={Boolean(errors.holder)}
              />
              {errors.holder ? <p className="tp-field-error">{errors.holder}</p> : null}

              <label className="tp-label" htmlFor="pay-email">Email for the receipt</label>
              <input
                id="pay-email"
                className="tp-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={pending}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email ? <p className="tp-field-error">{errors.email}</p> : null}

              {method === "CARD" ? (
                <>
                  <label className="tp-label" htmlFor="pay-card">Card number</label>
                  <div className="tp-pay-field">
                    <input
                      id="pay-card"
                      className="tp-input"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="1234 5678 9012 3456"
                      value={card}
                      maxLength={23}
                      onChange={(event) => {
                        const next = event.target.value.replace(/\D/g, "").slice(0, 19);
                        setCard(next.replace(/(.{4})/g, "$1 ").trim());
                      }}
                      disabled={pending}
                      aria-invalid={Boolean(errors.card)}
                    />
                    {brand ? <span className="tp-pay-brand">{brand}</span> : null}
                  </div>
                  {errors.card ? <p className="tp-field-error">{errors.card}</p> : null}

                  <div className="tp-pay-row">
                    <div>
                      <label className="tp-label" htmlFor="pay-expiry">Expiry</label>
                      <input
                        id="pay-expiry"
                        className="tp-input"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="MM/YY"
                        value={expiry}
                        maxLength={5}
                        onChange={(event) => {
                          const next = event.target.value.replace(/\D/g, "").slice(0, 4);
                          setExpiry(next.length > 2 ? `${next.slice(0, 2)}/${next.slice(2)}` : next);
                        }}
                        disabled={pending}
                        aria-invalid={Boolean(errors.expiry)}
                      />
                      {errors.expiry ? <p className="tp-field-error">{errors.expiry}</p> : null}
                    </div>
                    <div>
                      <label className="tp-label" htmlFor="pay-cvv">CVV</label>
                      <input
                        id="pay-cvv"
                        className="tp-input"
                        type="password"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="•••"
                        value={cvv}
                        maxLength={4}
                        onChange={(event) => setCvv(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        disabled={pending}
                        aria-invalid={Boolean(errors.cvv)}
                      />
                      {errors.cvv ? <p className="tp-field-error">{errors.cvv}</p> : null}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label className="tp-label" htmlFor="pay-upi">UPI ID</label>
                  <input
                    id="pay-upi"
                    className="tp-input"
                    placeholder="name@bank"
                    value={upi}
                    onChange={(event) => setUpi(event.target.value.trim())}
                    autoComplete="off"
                    disabled={pending}
                    aria-invalid={Boolean(errors.upi)}
                  />
                  {errors.upi ? <p className="tp-field-error">{errors.upi}</p> : null}
                  <p className="tp-xs tp-faint">A collect request is raised on this UPI ID for {price}.</p>
                </>
              )}

              <button type="submit" className="tp-btn tp-btn-block tp-pay-submit" disabled={pending}>
                <Icon name="lock" size={15} /> Pay {price}
              </button>
              <p className="tp-pay-secure">
                <Icon name="shield" size={13} /> Details are used only to authorise this payment. The card number and CVV are never stored.
              </p>
            </form>
          </div>
        )}
      </dialog>
    </section>
  );
}
