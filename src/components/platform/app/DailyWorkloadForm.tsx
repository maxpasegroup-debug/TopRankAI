"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDailyWorkload } from "@/server/actions/platform";
import { levelForPapers } from "@/shared/daily-workload";

export function DailyWorkloadForm({ targetId, count, included, capacity, monthlyUntil, durationMinutes }: {
  targetId: string; count: number; included: number; capacity: number; monthlyUntil: string | null; durationMinutes: number;
}) {
  const [requested, setRequested] = useState(count);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const needsMonthly = requested > included && !monthlyUntil;
  const level = levelForPapers(requested).toLowerCase();

  return (
    <form className="tp-card tp-card-pad tp-stack tp-gap-12 tp-mb-24" onSubmit={(event) => {
      event.preventDefault();
      startTransition(async () => {
        const result = await saveDailyWorkload(targetId, requested, needsMonthly);
        setMessage(result.message);
        if (result.ok) router.refresh();
      });
    }}>
      <h2 style={{ fontSize: 18 }}>Daily workload</h2>
      <p className="tp-small tp-muted">{included} {included === 1 ? "paper" : "papers"} per day included.
        {monthlyUntil ? ` Mock monthly access through ${monthlyUntil}.` : " Extra papers require mock monthly access."}</p>
      <p className="tp-small tp-muted">
        Each paper is the full official paper: {durationMinutes} minutes. Your study target becomes
        {" "}<strong>{requested * durationMinutes} minutes</strong> of paper time for {requested} paper{requested === 1 ? "" : "s"}.
      </p>
      <div className="tp-row tp-wrap">
        <label htmlFor="daily-count">Papers per day</label>
        <select id="daily-count" className="tp-select" style={{ width: "auto" }} value={requested}
          onChange={(event) => { setRequested(Number(event.target.value)); setMessage(""); }}>
          {Array.from({ length: capacity }, (_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}
        </select>
        <span className="tp-pill tp-capitalize">{level}</span>
        <button className="tp-btn tp-btn-sm" disabled={pending || requested === count}>
          {pending ? "Saving…" : needsMonthly ? "Activate mock month and save" : "Save schedule"}
        </button>
      </div>
      {needsMonthly && <p className="tp-small tp-muted">Includes 30 days of extra papers. No charge or automatic renewal.</p>}
      <p role="status" className="tp-small" hidden={!message}>{message}</p>
    </form>
  );
}
