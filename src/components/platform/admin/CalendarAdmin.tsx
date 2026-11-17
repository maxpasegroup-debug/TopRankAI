"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { useToastFeedback } from "../useToastFeedback";
import { addCalendarAction, importCalendarAction } from "@/server/actions/admin";

export type AdminCalendarRow = {
  id: string;
  examCode: string;
  examName: string;
  eventType: string;
  title: string;
  startLabel: string;
  endLabel: string | null;
  status: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  notes: string | null;
  upcoming: boolean;
};

const eventTypes = [
  ["APPLICATION_START", "Application opens"],
  ["APPLICATION_END", "Application closes"],
  ["ADMIT_CARD", "Admit card"],
  ["EXAM", "Exam date"],
  ["RESULT", "Result"],
  ["COUNSELLING", "Counselling"],
  ["OTHER", "Other"],
] as const;

export function CalendarAdmin({ exams, events }: { exams: { id: string; code: string; name: string }[]; events: AdminCalendarRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  useToastFeedback(message, setMessage, error, setError);
  useToastFeedback(importMessage, setImportMessage, importError, setImportError);
  const [form, setForm] = useState({
    examId: exams[0]?.id ?? "",
    eventType: "EXAM" as (typeof eventTypes)[number][0],
    title: "",
    startDate: "",
    endDate: "",
    status: "TENTATIVE" as "CONFIRMED" | "TENTATIVE" | "NOT_ANNOUNCED",
    sourceUrl: "",
    sourceLabel: "",
    notes: "",
  });

  const upcoming = events.filter((event) => event.upcoming);
  const past = events.filter((event) => !event.upcoming);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await addCalendarAction({
        ...form,
        endDate: form.endDate || undefined,
        sourceUrl: form.sourceUrl || undefined,
        sourceLabel: form.sourceLabel || undefined,
        notes: form.notes || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setForm((current) => ({ ...current, title: "", startDate: "", endDate: "", sourceUrl: "", sourceLabel: "", notes: "" }));
      router.refresh();
    });
  }

  function runImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportMessage(null);
    setImportError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(importText);
    } catch {
      setImportError("The payload is not valid JSON.");
      return;
    }
    startTransition(async () => {
      const result = await importCalendarAction({ ...(payload as Record<string, unknown>), examId: form.examId });
      if (!result.ok) {
        setImportError(result.message);
        return;
      }
      setImportMessage(result.message);
      setImportText("");
      router.refresh();
    });
  }

  return (
    <div className="tp-stack tp-gap-20">
      <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Record a calendar event</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>
            Only record dates you can attribute to an official notification. Confirmed events notify every candidate
            preparing for the exam.
          </p>
          <form onSubmit={submit}>
            <div className="tp-form-grid">
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="cal-exam">Exam <span>*</span></label>
                <select id="cal-exam" className="tp-select" value={form.examId} onChange={(event) => update("examId", event.target.value)} required>
                  {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                </select>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="cal-type">Event type</label>
                <select id="cal-type" className="tp-select" value={form.eventType} onChange={(event) => update("eventType", event.target.value as typeof form.eventType)}>
                  {eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="cal-status">Verification</label>
                <select id="cal-status" className="tp-select" value={form.status} onChange={(event) => update("status", event.target.value as typeof form.status)}>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="TENTATIVE">Tentative</option>
                  <option value="NOT_ANNOUNCED">Not announced</option>
                </select>
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="cal-title">Title <span>*</span></label>
                <input id="cal-title" className="tp-input" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Preliminary examination" required minLength={3} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="cal-start">Start date <span>*</span></label>
                <input id="cal-start" className="tp-input" type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} required />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="cal-end">End date</label>
                <input id="cal-end" className="tp-input" type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="cal-source">Source URL</label>
                <input id="cal-source" className="tp-input" value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://…" />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="cal-source-label">Source label</label>
                <input id="cal-source-label" className="tp-input" value={form.sourceLabel} onChange={(event) => update("sourceLabel", event.target.value)} placeholder="Official notification PDF" />
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="cal-notes">Notes</label>
                <textarea id="cal-notes" className="tp-input" rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
              </div>
            </div>
            <button type="submit" className="tp-btn tp-mt-16" disabled={pending}>
              {pending ? "Saving…" : "Save event"} {pending ? null : <Icon name="calendar" size={15} />}
            </button>
          </form>
        </section>

        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Calendar policy</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>The platform shows an honest empty state rather than guessing.</p>
          <div className="tp-stack tp-gap-12 tp-small tp-muted">
            <p><strong style={{ color: "var(--tp-ink)" }}>No guessed dates.</strong> If an exam has not announced its cycle, no event is created. The candidate calendar says so explicitly.</p>
            <p><strong style={{ color: "var(--tp-ink)" }}>Source required.</strong> Confirmed events should always carry a source URL or an official notification label.</p>
            <p><strong style={{ color: "var(--tp-ink)" }}>Targets update.</strong> A confirmed exam date also updates the target date for every active candidate plan.</p>
          </div>
          <div className="tp-note tp-mt-16">
            There is no free official API that publishes every Indian exam calendar. Recording events here is the
            deliberate, reviewable alternative.
          </div>
        </section>
      </div>

      <details className="tp-card">
        <summary className="tp-row-between" style={{ padding: "14px 18px", cursor: "pointer", listStyle: "none" }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Import verified calendar events</h2>
            <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>Paste a JSON bundle from an official notification. Duplicate events are skipped, so re-running is safe.</div>
          </div>
          <Icon name="upload" size={18} />
        </summary>
        <div style={{ borderTop: "1px solid var(--tp-line)", padding: "16px 18px" }}>
          <form onSubmit={runImport}>
            <div className="tp-field">
              <label className="tp-label" htmlFor="calendar-import">JSON payload</label>
              <textarea
                id="calendar-import"
                className="tp-input"
                rows={8}
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={'{"sourceLabel":"Official notification","sourceUrl":"https://...","events":[{"eventType":"EXAM","title":"Preliminary examination","startDate":"2027-04-04","status":"CONFIRMED"}]}'}
                spellCheck={false}
              />
              <span className="tp-hint">
                Events are imported into the exam currently selected in the form above. Duplicate titles on the same
                date and type are skipped.
              </span>
            </div>
            <button type="submit" className="tp-btn tp-btn-soft tp-btn-sm tp-mt-12" disabled={pending || !importText.trim()}>
              {pending ? "Importing…" : "Import events"} {pending ? null : <Icon name="upload" size={14} />}
            </button>
          </form>
        </div>
      </details>

      <section>
        <div className="tp-row-between" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>Recorded events</h2>
          <span className="tp-pill">{upcoming.length} upcoming · {past.length} past</span>
        </div>
        {events.length ? (
          <div className="tp-stack tp-gap-10">
            {[...upcoming, ...past].map((event) => (
              <article className="tp-card tp-card-pad" key={event.id}>
                <div className="tp-row-between tp-wrap tp-gap-8" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="tp-row tp-gap-8 tp-wrap">
                      <span className="tp-pill tp-pill-brand">{event.examCode}</span>
                      <span className="tp-pill">{event.eventType.replace(/_/g, " ").toLowerCase()}</span>
                      <span className={`tp-pill ${event.status === "CONFIRMED" ? "tp-pill-ok" : "tp-pill-warn"}`}>{event.status.toLowerCase()}</span>
                    </div>
                    <h3 style={{ fontSize: 15, margin: "8px 0 4px" }}>{event.title}</h3>
                    <div className="tp-xs tp-muted">
                      {event.startLabel}{event.endLabel ? ` – ${event.endLabel}` : ""} · {event.examName}
                    </div>
                    {event.notes ? <div className="tp-xs tp-faint" style={{ marginTop: 4 }}>{event.notes}</div> : null}
                  </div>
                  <div className="tp-stack tp-gap-4" style={{ alignItems: "flex-end" }}>
                    {event.sourceUrl ? (
                      <a className="tp-link tp-xs" href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{event.sourceLabel ?? "Official source"}</a>
                    ) : (
                      <span className="tp-xs tp-faint">No source recorded</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tp-empty">
            <h3>No calendar event recorded</h3>
            <p>That is intentional until an official date is confirmed. Record the first verified event above.</p>
          </div>
        )}
      </section>
    </div>
  );
}
