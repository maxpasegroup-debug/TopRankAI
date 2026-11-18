"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { protectStreak } from "@/server/actions/pro";

export type FreezeCardState = {
  code: string;
  pro: boolean;
  allowance: number;
  used: number;
  remaining: number;
  frozenDates: { date: string; createdAt: string }[];
  yesterday: string;
  canProtectYesterday: boolean;
  reason: string | null;
};

export function StreakFreezeCard({ state }: { state: FreezeCardState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function protect() {
    if (pending) return;
    startTransition(async () => {
      const result = await protectStreak(state.code);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${result.data.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} is protected. ${result.data.remaining} freeze${result.data.remaining === 1 ? "" : "s"} left this month.`);
      router.refresh();
    });
  }

  const usedPercent = state.allowance ? Math.min(100, (state.used / state.allowance) * 100) : 0;

  return (
    <section className={`tp-card tp-card-pad tp-freeze-card ${state.pro ? "" : "tp-freeze-card-free"}`}>
      <div className="tp-row-between tp-gap-10 tp-wrap" style={{ marginBottom: 10 }}>
        <div className="tp-row tp-gap-8">
          <span className="tp-freeze-icon"><Icon name="flame" size={18} /></span>
          <div>
            <h3 style={{ fontSize: 16 }}>Streak freeze</h3>
            <p className="tp-xs tp-faint">Protect one missed day without inventing a paper.</p>
          </div>
        </div>
        <span className={`tp-pro-badge ${state.pro ? "" : "tp-pro-badge-quiet"}`}>
          <Icon name="crown" size={12} /> Pro
        </span>
      </div>

      {state.pro ? (
        <>
          <div className="tp-row-between tp-xs tp-faint" style={{ marginBottom: 5 }}>
            <span>{state.used} of {state.allowance} used this month</span>
            <span>{state.remaining} left</span>
          </div>
          <div className="tp-meter tp-meter-gold"><span style={{ width: `${usedPercent}%` }} /></div>

          <div className="tp-freeze-day">
            <div>
              <span className="tp-xs tp-faint">Yesterday</span>
              <strong>{state.yesterday}</strong>
            </div>
            {state.frozenDates.some((item) => item.date === state.yesterday) ? (
              <span className="tp-pill tp-pill-ok"><Icon name="shield" size={12} /> Protected</span>
            ) : state.canProtectYesterday ? (
              <button type="button" className="tp-btn tp-btn-sm" onClick={protect} disabled={pending}>
                {pending ? <><span className="tp-spinner" /> Protecting…</> : <><Icon name="shield" size={14} /> Protect yesterday</>}
              </button>
            ) : (
              <span className="tp-pill">Not needed</span>
            )}
          </div>

          {state.reason && !state.canProtectYesterday ? (
            <p className="tp-xs tp-faint" style={{ marginTop: 8 }}>{state.reason}</p>
          ) : (
            <p className="tp-xs tp-faint" style={{ marginTop: 8 }}>
              A freeze keeps the streak count. It does not add a day or count as practice.
            </p>
          )}

          {state.frozenDates.length && !state.frozenDates.some((item) => item.date === state.yesterday) ? (
            <button type="button" className="tp-freeze-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
              {open ? "Hide" : "Show"} protected days
              <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />
            </button>
          ) : null}
          {open ? (
            <div className="tp-freeze-list">
              {state.frozenDates.map((item) => (
                <span className="tp-pill" key={item.date}><Icon name="shield" size={11} /> {item.date}</span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="tp-small tp-muted">
            Two freezes a month are part of Pro. They cover a missed day when the day before was an active study day,
            so the streak keeps its count.
          </p>
          <Link className="tp-btn tp-btn-sm tp-btn-block tp-mt-12" href="/app/subscriptions">
            See Pro plans <Icon name="arrow-right" size={14} />
          </Link>
        </>
      )}
    </section>
  );
}
