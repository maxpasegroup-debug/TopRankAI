"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDailyWorkload } from "@/server/actions/platform";
import { levelForPapers, MAX_DAILY_PAPERS } from "@/shared/daily-workload";

export function DailyWorkloadForm({
  targetId,
  count,
  included,
  monthlyUntil,
  durationMinutes,
}: {
  targetId: string;
  count: number;
  included: number;
  monthlyUntil: string | null;
  durationMinutes: number;
}) {
  const [requested, setRequested] = useState(count);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const needsMonthly = requested > included && !monthlyUntil;
  const level = levelForPapers(requested).toLowerCase();
  const paperMinutes = requested * durationMinutes;

  return (
    <form
      className="tp-card tp-card-pad tp-stack tp-gap-12 tp-mb-24"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        startTransition(async () => {
          const result = await saveDailyWorkload(targetId, requested, needsMonthly);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setMessage(result.message);
          router.refresh();
        });
      }}
    >
      <h2 style={{ fontSize: 18 }}>Daily workload</h2>
      <p className="tp-small tp-muted">
        {included} {included === 1 ? "paper" : "papers"} per day are included in your level.
        {monthlyUntil ? ` Mock monthly plan active through ${monthlyUntil}.` : " Extra papers need the mock monthly plan."}
      </p>
      <p className="tp-small tp-muted">
        Each paper is the full official paper: {durationMinutes} minutes. {requested} paper{requested === 1 ? "" : "s"} ={" "}
        <strong>{paperMinutes} minutes of exam time</strong>. Study/revision time is tracked separately.
      </p>
      <div className="tp-row tp-wrap">
        <label htmlFor="daily-count">Papers per day</label>
        <select
          id="daily-count"
          className="tp-select"
          style={{ width: "auto" }}
          value={requested}
          onChange={(event) => {
            setRequested(Number(event.target.value));
            setMessage("");
            setError("");
          }}
        >
          {Array.from({ length: MAX_DAILY_PAPERS }, (_, index) => {
            const value = index + 1;
            return (
              <option value={value} key={value}>
                {value} {value > included ? "(monthly)" : ""}
              </option>
            );
          })}
        </select>
        <span className="tp-pill tp-capitalize">{level}</span>
        <button className="tp-btn tp-btn-sm" disabled={pending || (requested === count && !needsMonthly)}>
          {pending ? "Saving…" : needsMonthly ? "Pay mock & save" : "Save schedule"}
        </button>
      </div>

      {needsMonthly ? (
        <div className="tp-note">
          <strong>Mock monthly plan</strong>
          <div style={{ marginTop: 4 }}>
            Extra papers above your level. Test checkout only: no payment gateway, no card details, and no money is
            charged. Activating adds 30 days of extra-paper access.
          </div>
        </div>
      ) : null}

      {error ? <p className="tp-error" role="alert">{error}</p> : null}
      {message ? <p className="tp-success" role="status">{message}</p> : null}
    </form>
  );
}
