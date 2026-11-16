import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/platform/Icon";
import { DailyPlayer } from "@/components/platform/app/DailyPlayer";
import { StartExamButton } from "@/components/platform/app/StartExamButton";
import { requireAuth } from "@/server/auth/session";
import { getAttemptPaper } from "@/server/platform/daily-exam";
import { formatDate, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily exam" };

export default async function DailyExamPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  let paper;
  try {
    paper = await getAttemptPaper(user.id, id);
  } catch {
    notFound();
  }

  if (paper.state === "SUBMITTED") redirect(`/app/daily/${id}/result`);

  const daily = paper.dailyExam;
  const meta = paper.meta;

  if (paper.state === "NOT_STARTED") {
    const warning = daily.status === "MISSED" || daily.status === "EXPIRED" || daily.status === "SUBMITTED";
    return (
      <>
        <div className="tp-page-head">
          <div>
            <div className="tp-eyebrow">Daily exam</div>
            <h1>{daily.title}</h1>
            <p>{formatDate(daily.scheduledDate, { weekday: "long", day: "numeric", month: "long" })}</p>
            {meta ? (
              <div className="tp-row tp-gap-8 tp-wrap" style={{ marginTop: 10 }}>
                <span className={`tp-pill ${meta.mode === "FULL_MOCK" ? "tp-pill-ok" : "tp-pill-warn"}`}>
                  {meta.mode === "FULL_MOCK" ? "Full official mock" : "Practice set"}
                </span>
                <span className="tp-pill">
                  {meta.mode === "FULL_MOCK"
                    ? `${daily.questionIds.length} questions · ${daily.durationMinutes} minutes`
                    : `${daily.questionIds.length} of ${meta.officialTotal} official questions`}
                </span>
              </div>
            ) : null}
          </div>
          <Link className="tp-btn tp-btn-ghost" href="/app/daily">Back to papers</Link>
        </div>

        <div className="tp-dash">
          <section className="tp-daily-card">
            <span className="tp-eyebrow">Ready when you are</span>
            <h2>{warning ? "This paper is closed." : "The timer starts when you begin."}</h2>
            <p className="tp-small tp-muted" style={{ maxWidth: 540 }}>
              {warning
                ? "This daily paper belongs to a previous day or was already closed. It cannot be started now. A missed day is recorded honestly rather than back-filled."
                : "Answer every question you can. You can flag questions and revisit them before submitting. The paper closes automatically when the timer ends."}
            </p>
            <div className="tp-daily-facts">
              <span className="tp-daily-fact"><Icon name="layers" />{daily.questionIds.length} questions</span>
              <span className="tp-daily-fact"><Icon name="clock" />{daily.durationMinutes} minutes</span>
              <span className="tp-daily-fact"><Icon name="target" />{toNumber(daily.totalMarks)} marks</span>
            </div>
            {warning ? (
              <Link className="tp-btn" href="/app/daily">View paper history</Link>
            ) : (
              <StartExamButton dailyExamId={daily.id} />
            )}
          </section>

          <aside className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>Before you begin</h3>
            <div className="tp-stack tp-gap-12 tp-small tp-muted">
              <p><strong style={{ color: "var(--tp-ink)" }}>One attempt.</strong> Submitting ends the paper for today.</p>
              <p><strong style={{ color: "var(--tp-ink)" }}>Negative marking applies.</strong> Check the marking model on your dashboard before you guess.</p>
              <p><strong style={{ color: "var(--tp-ink)" }}>Server timing.</strong> The deadline is stored on the server, so refreshing the page does not reset the clock.</p>
            </div>
            <div className="tp-note tp-mt-16">
              <strong>Scoring.</strong> Marks and accuracy are calculated from the stored answer key on submission.
              {daily.slot > 0 ? " This follow-up set fits the time reserved between study breaks." : meta?.mode === "PRACTICE_SET" ? " This paper is a practice set because the reviewed bank does not yet cover the full official question count." : ""}
            </div>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">In progress</div>
          <h1>{daily.title}</h1>
          <p>{daily.questionIds.length} questions · {daily.durationMinutes} minutes · the clock is running</p>
        </div>
        <span className="tp-pill tp-pill-warn"><Icon name="clock" size={14} /> Do not refresh unnecessarily</span>
      </div>

      <DailyPlayer
        dailyExamId={daily.id}
        attemptId={paper.attempt.id}
        paper={paper.paper}
        remainingSeconds={paper.remainingSeconds}
        durationMinutes={daily.durationMinutes}
        totalMarks={toNumber(daily.totalMarks)}
      />
    </>
  );
}
