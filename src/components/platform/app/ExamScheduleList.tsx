"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { saveDailyWorkload } from "@/server/actions/platform";
import { MAX_DAILY_PAPERS } from "@/shared/daily-workload";

export type ExamScheduleRow = {
  targetId: string;
  code: string;
  name: string;
  count: number;
  included: number;
  durationMinutes: number;
  startMinutes: number;
  monthlyUntil: string | null;
};

function timeValue(minutes?: number) {
  const safe = Number.isFinite(minutes) ? Math.min(1439, Math.max(0, minutes as number)) : 480;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function minutesValue(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 480;
  return Math.min(1439, Math.max(0, hours * 60 + minutes));
}

export function ExamScheduleList({ rows, activeCode }: { rows: ExamScheduleRow[]; activeCode: string }) {
  return (
    <section className="tp-card tp-card-pad tp-mb-24">
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 18 }}>Schedules for all your exams</h2>
        <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>
          Set papers per day and the start time (IST) for each exam. Every paper is the full official paper;
          later papers follow after a 45-minute break.
        </p>
      </div>
      <div className="tp-stack tp-gap-12">
        {rows.map((row) => <ScheduleRow key={row.targetId} row={row} active={row.code === activeCode} />)}
      </div>
    </section>
  );
}

function ScheduleRow({ row, active }: { row: ExamScheduleRow; active: boolean }) {
  const [count, setCount] = useState(row.count);
  const [start, setStart] = useState(timeValue(row.startMinutes));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const needsMonthly = count > row.included && !row.monthlyUntil;
  const changed = count !== row.count || minutesValue(start) !== row.startMinutes;

  return (
    <div className="tp-list-item" style={{ alignItems: "flex-start" }}>
      <div className="tp-grow">
        <div className="tp-row tp-gap-8 tp-wrap">
          <strong>{row.name}</strong>
          {active ? <span className="tp-pill tp-pill-brand">Active</span> : null}
          {row.monthlyUntil ? <span className="tp-pro-badge" style={{ padding: "4px 8px", fontSize: 9.5 }}><Icon name="crown" size={11} /> Paid</span> : null}
        </div>
        <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>
          {row.durationMinutes} min official paper · starts {start} IST
          {row.monthlyUntil ? ` · extra papers until ${row.monthlyUntil}` : ""}
        </div>
      </div>
      <div className="tp-stack tp-gap-6 tp-schedule-controls">
        <div className="tp-row tp-gap-8 tp-wrap">
          <label className="tp-xs tp-muted" htmlFor={`papers-${row.targetId}`}>Papers</label>
          <select
            id={`papers-${row.targetId}`}
            className="tp-select"
            style={{ width: "auto" }}
            value={count}
            onChange={(event) => {
              setCount(Number(event.target.value));
            }}
          >
            {Array.from({ length: MAX_DAILY_PAPERS }, (_, index) => {
              const value = index + 1;
              return <option value={value} key={value}>{value}{value > row.included ? " (Paid)" : ""}</option>;
            })}
          </select>
          <label className="tp-xs tp-muted" htmlFor={`start-${row.targetId}`}>Start</label>
          <input
            id={`start-${row.targetId}`}
            className="tp-input"
            type="time"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
            }}
            style={{ width: 140, flex: "none", minHeight: 34, padding: "2px 8px" }}
          />
          <span className="tp-xs tp-faint">IST</span>
          <button
            type="button"
            className="tp-btn tp-btn-sm"
            disabled={pending || (!changed && !needsMonthly)}
            onClick={() => {
              if (needsMonthly) {
                router.push(`/app/subscriptions?target=${encodeURIComponent(row.targetId)}&papers=${count}&start=${minutesValue(start)}`);
                return;
              }
              const toastId = toast.loading("Saving schedule…");
              startTransition(async () => {
                const result = await saveDailyWorkload(row.targetId, count, minutesValue(start));
                if (!result.ok) {
                  toast.error(result.message, { id: toastId });
                  return;
                }
                toast.success(result.message, { id: toastId });
                router.refresh();
              });
            }}
          >
            {pending ? "Saving…" : needsMonthly ? "View subscriptions" : "Save"}
          </button>
        </div>
        {needsMonthly ? (
          <span className="tp-xs tp-faint">Extra papers across all your exams, activated from Subscriptions.</span>
        ) : null}
      </div>
    </div>
  );
}
