"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveDailyWorkload } from "@/server/actions/platform";
import { MAX_DAILY_PAPERS } from "@/shared/daily-workload";

export type ExamScheduleRow = {
  targetId: string;
  code: string;
  name: string;
  count: number;
  included: number;
  durationMinutes: number;
  studyMinutes: number;
  monthlyUntil: string | null;
};

export function ExamScheduleList({ rows, activeCode }: { rows: ExamScheduleRow[]; activeCode: string }) {
  return (
    <section className="tp-card tp-card-pad tp-mb-24">
      <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>Schedules for all your exams</h2>
          <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>
            Change papers per day for each exam. Daily study time is set separately in My exams.
          </p>
        </div>
        <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/exams">Edit study time</Link>
      </div>
      <div className="tp-stack tp-gap-12">
        {rows.map((row) => <ScheduleRow key={row.targetId} row={row} active={row.code === activeCode} />)}
      </div>
    </section>
  );
}

function ScheduleRow({ row, active }: { row: ExamScheduleRow; active: boolean }) {
  const [count, setCount] = useState(row.count);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const needsMonthly = count > row.included && !row.monthlyUntil;

  return (
    <div className="tp-list-item" style={{ alignItems: "flex-start" }}>
      <div className="tp-grow">
        <div className="tp-row tp-gap-8 tp-wrap">
          <strong>{row.name}</strong>
          {active ? <span className="tp-pill tp-pill-brand">Active</span> : null}
          {row.monthlyUntil ? <span className="tp-pill tp-pill-ok">Mock monthly</span> : null}
        </div>
        <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>
          {row.durationMinutes} min official paper · {row.studyMinutes} min study target
          {row.monthlyUntil ? ` · extra papers until ${row.monthlyUntil}` : ""}
        </div>
      </div>
      <div className="tp-stack tp-gap-6" style={{ minWidth: 230 }}>
        <div className="tp-row tp-gap-8">
          <select
            className="tp-select"
            style={{ width: "auto" }}
            value={count}
            onChange={(event) => {
              setCount(Number(event.target.value));
              setMessage("");
              setError("");
            }}
            aria-label={`Papers per day for ${row.name}`}
          >
            {Array.from({ length: MAX_DAILY_PAPERS }, (_, index) => {
              const value = index + 1;
              return <option value={value} key={value}>{value}{value > row.included ? " (monthly)" : ""}</option>;
            })}
          </select>
          <button
            type="button"
            className="tp-btn tp-btn-sm"
            disabled={pending || (count === row.count && !needsMonthly)}
            onClick={() => {
              setMessage("");
              setError("");
              startTransition(async () => {
                const result = await saveDailyWorkload(row.targetId, count, needsMonthly);
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                setMessage(result.message);
              });
            }}
          >
            {pending ? "Saving…" : needsMonthly ? "Pay mock & save" : "Save"}
          </button>
        </div>
        {needsMonthly ? (
          <span className="tp-xs tp-faint">Mock monthly checkout — no payment gateway, no money charged.</span>
        ) : null}
        {message ? <span className="tp-xs" style={{ color: "var(--tp-ok)" }}>{message}</span> : null}
        {error ? <span className="tp-xs" style={{ color: "var(--tp-danger)" }}>{error}</span> : null}
      </div>
    </div>
  );
}
