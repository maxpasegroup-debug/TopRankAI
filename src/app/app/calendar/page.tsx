import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getCalendarData } from "@/server/platform/insights";
import { formatDate } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

const eventTone: Record<string, string> = {
  EXAM: "tp-pill-accent",
  APPLICATION_START: "tp-pill-brand",
  APPLICATION_END: "tp-pill-warn",
  ADMIT_CARD: "tp-pill-brand",
  RESULT: "tp-pill-ok",
  COUNSELLING: "tp-pill",
  OTHER: "",
};

export default async function CalendarPage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head"><div><div className="tp-eyebrow">Calendar</div><h1>Choose an exam first</h1></div></div>
        <div className="tp-empty">
          <h3>No exam in your plan</h3>
          <p>The calendar shows events for the exams you are preparing for.</p>
          <Link className="tp-btn" href="/app/exams">Choose exams</Link>
        </div>
      </>
    );
  }

  const data = await getCalendarData(user.id, exam);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const upcoming = data.events.filter((event) => event.startDate.getTime() >= today.getTime());
  const past = data.events.filter((event) => event.startDate.getTime() < today.getTime()).reverse();

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.shortName ?? exam.name}</div>
          <h1>Exam calendar</h1>
          <p>Verified events for every exam in your plan. Dates appear only when an official source has been recorded.</p>
        </div>
        <span className="tp-pill"><Icon name="shield" size={14} /> No guessed dates</span>
      </div>

      <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <div className="tp-row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 17 }}>Your target dates</h3>
            <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/exams">Edit plan</Link>
          </div>
          <div className="tp-stack tp-gap-12">
            {data.exams.map((item) => (
              <div className="tp-list-item" key={item.examId} style={{ padding: "10px 0" }}>
                <span className="tp-activity-badge"><Icon name="target" size={16} /></span>
                <div className="tp-grow">
                  <div className="tp-activity-title" style={{ fontWeight: 600 }}>{item.exam.name}</div>
                  <div className="tp-activity-meta">
                    {item.targetExamDate ? `Target ${formatDate(item.targetExamDate)}` : "No target date set — set one from My exams"}
                  </div>
                </div>
                {item.examId === data.selectedExamId ? <span className="tp-pill tp-pill-brand">Active</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="tp-card tp-card-pad">
          <h3 style={{ fontSize: 17, marginBottom: 12 }}>Upcoming</h3>
          {upcoming.length ? (
            <div>
              {upcoming.map((event) => (
                <div className="tp-list-item" key={event.id} style={{ alignItems: "flex-start" }}>
                  <span className="tp-activity-badge"><Icon name="calendar" size={16} /></span>
                  <div className="tp-grow">
                    <div className="tp-activity-title" style={{ fontWeight: 600 }}>{event.title}</div>
                    <div className="tp-activity-meta">
                      {event.exam.name} · {formatDate(event.startDate)}{event.endDate ? ` – ${formatDate(event.endDate)}` : ""}
                    </div>
                    {event.notes ? <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>{event.notes}</div> : null}
                    {event.sourceUrl ? (
                      <a className="tp-link tp-xs" href={event.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 4 }}>
                        {event.sourceLabel ?? "Official source"}
                      </a>
                    ) : null}
                  </div>
                  <div className="tp-stack tp-gap-8" style={{ alignItems: "flex-end" }}>
                    <span className={`tp-pill ${eventTone[event.eventType] ?? ""}`}>{event.eventType.replace(/_/g, " ").toLowerCase()}</span>
                    <span className={`tp-pill ${event.status === "CONFIRMED" ? "tp-pill-ok" : "tp-pill-warn"}`}>{event.status.toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="tp-empty" style={{ padding: "28px 16px" }}>
              <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="calendar" /></span>
              <h3>No verified upcoming date</h3>
              <p>
                No official event has been recorded for your exams in this cycle. The platform does not publish
                guessed dates. Check the official website and ask an administrator to record a confirmed event.
              </p>
              {exam.officialUrl ? (
                <a className="tp-btn tp-btn-soft tp-btn-sm" href={exam.officialUrl} target="_blank" rel="noopener noreferrer">
                  Check official website
                </a>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {past.length ? (
        <section className="tp-mt-24">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Past events</h2>
          <div className="tp-card">
            {past.map((event) => (
              <div className="tp-list-item" key={event.id} style={{ padding: "14px 20px" }}>
                <span className="tp-activity-badge"><Icon name="calendar" size={16} /></span>
                <div className="tp-grow">
                  <div className="tp-activity-title">{event.title}</div>
                  <div className="tp-activity-meta">{event.exam.name} · {formatDate(event.startDate)}</div>
                </div>
                <span className={`tp-pill ${eventTone[event.eventType] ?? ""}`}>{event.eventType.replace(/_/g, " ").toLowerCase()}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="tp-note tp-mt-24">
        <strong>How dates are verified.</strong> An administrator records each event with its official URL and marks
        it confirmed or tentative. There is no free official API that publishes every Indian exam date, so this
        curated record is maintained deliberately and reviewed before it is shown.
      </div>
    </>
  );
}
