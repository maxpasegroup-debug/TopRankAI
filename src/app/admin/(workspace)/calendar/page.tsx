import Link from "next/link";
import { CalendarAdmin, type AdminCalendarRow } from "@/components/platform/admin/CalendarAdmin";
import { listAdminCalendar, listAdminExamOptions } from "@/server/admin/platform-admin";
import { formatDate, startOfDayUtc } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exam calendar" };

export default async function AdminCalendarPage() {
  const [events, exams] = await Promise.all([listAdminCalendar(), listAdminExamOptions()]);
  const today = startOfDayUtc();

  const rows: AdminCalendarRow[] = events.map((event) => ({
    id: event.id,
    examCode: event.exam.code,
    examName: event.exam.name,
    eventType: event.eventType,
    title: event.title,
    startLabel: formatDate(event.startDate),
    endLabel: event.endDate ? formatDate(event.endDate) : null,
    status: event.status,
    sourceUrl: event.sourceUrl,
    sourceLabel: event.sourceLabel,
    notes: event.notes,
    upcoming: event.startDate.getTime() >= today.getTime(),
  }));

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Content</div>
          <h1>Exam calendar</h1>
          <p>Verified dates only. Every event is attributed to an official source and reviewed by an administrator.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill">{rows.filter((row) => row.status === "CONFIRMED").length} confirmed</span>
          <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/calendar">Candidate view</Link>
        </div>
      </div>

      {exams.length ? (
        <CalendarAdmin exams={exams} events={rows} />
      ) : (
        <div className="tp-empty">
          <h3>No active exam</h3>
          <p>Create an exam before recording its calendar.</p>
          <Link className="tp-btn" href="/admin/exams">Open exam catalogue</Link>
        </div>
      )}
    </>
  );
}

