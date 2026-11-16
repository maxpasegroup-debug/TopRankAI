import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { PrepareExamButton } from "@/components/platform/app/PrepareExamButton";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getDailyHistory, readPaperMeta } from "@/server/platform/daily-exam";
import { formatDate, levelLabel, percent, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily exams" };

const modeLabel: Record<string, string> = {
  FULL_MOCK: "Full official mock",
  PRACTICE_SET: "Practice set",
};

const statusTone: Record<string, string> = {
  SCHEDULED: "tp-pill-brand",
  IN_PROGRESS: "tp-pill-warn",
  SUBMITTED: "tp-pill-ok",
  MISSED: "tp-pill-danger",
  EXPIRED: "tp-pill-danger",
};

const statusLabel: Record<string, string> = {
  SCHEDULED: "Ready",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  MISSED: "Missed",
  EXPIRED: "Expired",
};

export default async function DailyExamsPage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head">
          <div>
            <div className="tp-eyebrow">Daily exams</div>
            <h1>Choose an exam first</h1>
            <p>The daily paper is prepared for the exam in your plan.</p>
          </div>
        </div>
        <div className="tp-empty">
          <h3>No exam selected</h3>
          <p>Add an exam to your plan and a daily paper will be prepared for it.</p>
          <Link className="tp-btn" href="/app/exams">Choose exams</Link>
        </div>
      </>
    );
  }

  const history = await getDailyHistory(user.id, exam.examId);
  const today = history[0];
  const isToday = today && new Date(today.scheduledDate).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  const todays = isToday ? today : null;
  const submitted = history.filter((item) => item.attempt?.status === "SUBMITTED");
  const bestScore = submitted.reduce((best, item) => Math.max(best, percent(toNumber(item.attempt?.obtainedMarks), toNumber(item.attempt?.totalMarks))), 0);
  const averageAccuracy = submitted.length
    ? submitted.reduce((sum, item) => sum + toNumber(item.attempt?.accuracy), 0) / submitted.length
    : 0;
  const todayMeta = todays ? readPaperMeta(todays.configSnapshot) : null;
  const official = exam.part;

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.category ?? "Daily loop"}</div>
          <h1>Daily exams</h1>
          <p>
            {exam.shortName ?? exam.name} · {levelLabel(exam.level)} level
            {official ? ` · ${official.name}: ${official.totalQuestions} questions, ${official.durationMinutes} minutes, ${official.totalMarks} marks` : ""}
          </p>
        </div>
        {todays && todays.attempt?.status === "SUBMITTED" ? (
          <Link className="tp-btn tp-btn-ghost" href={`/app/daily/${todays.id}/result`}>Today&apos;s result</Link>
        ) : null}
      </div>

      <div className="tp-grid tp-grid-3 tp-mb-24">
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="check" size={15} /> Submitted</div>
          <div className="tp-stat-value">{submitted.length}<small> papers</small></div>
          <div className="tp-stat-note">Out of {history.length} generated</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="target" size={15} /> Best score</div>
          <div className="tp-stat-value">{bestScore.toFixed(0)}<small> %</small></div>
          <div className="tp-stat-note">Highest single-paper percentage</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="chart" size={15} /> Average accuracy</div>
          <div className="tp-stat-value">{averageAccuracy.toFixed(1)}<small> %</small></div>
          <div className="tp-stat-note">Correct ÷ attempted across papers</div>
        </div>
      </div>

      {!todays ? (
        <section className="tp-daily-card tp-mb-24">
          <div className="tp-row-between">
            <span className="tp-eyebrow">Today</span>
            <span className="tp-pill tp-pill-accent">{official ? `${official.durationMinutes} min paper` : `${exam.dailyTestMinutes} min`}</span>
          </div>
          <h2>Today&apos;s paper has not been prepared yet.</h2>
          <p className="tp-small tp-muted" style={{ maxWidth: 620 }}>
            The paper is drawn deterministically from the reviewed question bank, so it stays the same for your
            account all day. If the bank covers the full official question count, you get a complete mock. If it
            does not, you get a substantial practice set and the page tells you exactly how many official questions
            were available.
          </p>
          <div className="tp-daily-facts">
            <span className="tp-daily-fact"><Icon name="layers" />{official ? `${official.totalQuestions} official questions` : `${exam.dailyTestQuestions} questions`}</span>
            <span className="tp-daily-fact"><Icon name="clock" />{official ? `${official.durationMinutes} minutes` : `${exam.dailyTestMinutes} minutes`}</span>
            <span className="tp-daily-fact"><Icon name="target" />{official ? `${official.totalMarks} marks` : `${levelLabel(exam.level)}`}</span>
          </div>
          <PrepareExamButton code={exam.code} label="Prepare today's paper" />
        </section>
      ) : (
        <section className="tp-card tp-card-pad tp-mb-24">
          <div className="tp-row-between">
            <div>
              <div className="tp-row tp-gap-8 tp-wrap">
                <h3 style={{ fontSize: 18 }}>Today&apos;s paper</h3>
                <span className={`tp-pill ${statusTone[todays.status] ?? ""}`}>{statusLabel[todays.status] ?? todays.status}</span>
                {todayMeta ? (
                  <span className={`tp-pill ${todayMeta.mode === "FULL_MOCK" ? "tp-pill-ok" : "tp-pill-warn"}`}>{modeLabel[todayMeta.mode]}</span>
                ) : null}
              </div>
              <p className="tp-small tp-muted" style={{ marginTop: 6 }}>
                {todays.questionIds.length} questions · {todays.durationMinutes} minutes · {toNumber(todays.totalMarks)} total marks
              </p>
              {todayMeta ? (
                <p className="tp-xs tp-faint" style={{ marginTop: 4 }}>
                  Official {exam.shortName ?? exam.name} pattern: {todayMeta.officialTotal} questions, {todayMeta.officialDurationMinutes} minutes.
                  {todayMeta.mode === "PRACTICE_SET" ? " This practice set uses the reviewed questions currently available." : ""}
                </p>
              ) : null}
            </div>
            {todays.attempt?.status === "SUBMITTED" ? (
              <Link className="tp-btn" href={`/app/daily/${todays.id}/result`}>
                View result <Icon name="arrow-right" size={15} />
              </Link>
            ) : (
              <Link className="tp-btn" href={`/app/daily/${todays.id}`}>
                {todays.attempt ? "Resume" : "Start paper"} <Icon name="play" size={14} />
              </Link>
            )}
          </div>
        </section>
      )}

      <h2 style={{ fontSize: 20, marginBottom: 14 }}>Paper history</h2>
      {history.length ? (
        <div className="tp-table-wrap">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Paper</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Marks</th>
                <th>Accuracy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const submittedPaper = item.attempt?.status === "SUBMITTED";
                return (
                  <tr key={item.id}>
                    <td className="tp-nowrap">{formatDate(item.scheduledDate, { day: "numeric", month: "short" })}</td>
                    <td>{item.title}</td>
                    <td>{item.questionIds.length}</td>
                    <td><span className={`tp-pill ${statusTone[item.status] ?? ""}`}>{statusLabel[item.status] ?? item.status}</span></td>
                    <td>{submittedPaper ? `${toNumber(item.attempt?.obtainedMarks)} / ${toNumber(item.attempt?.totalMarks)}` : "—"}</td>
                    <td>{submittedPaper ? `${toNumber(item.attempt?.accuracy).toFixed(1)}%` : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {submittedPaper ? (
                        <Link className="tp-btn tp-btn-soft tp-btn-sm" href={`/app/daily/${item.id}/result`}>Result</Link>
                      ) : item.status === "SCHEDULED" || item.status === "IN_PROGRESS" ? (
                        <Link className="tp-btn tp-btn-ghost tp-btn-sm" href={`/app/daily/${item.id}`}>Open</Link>
                      ) : (
                        <span className="tp-xs tp-faint">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tp-empty">
          <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="calendar" /></span>
          <h3>No paper has been generated yet</h3>
          <p>Your first paper appears here once it has been prepared for the day.</p>
          <PrepareExamButton code={exam.code} label="Prepare today's paper" />
        </div>
      )}

      <div className="tp-note tp-mt-24">
        <strong>Honest record.</strong> A paper left unsubmitted on its scheduled day is marked missed. It is not
        deleted, and it does not count as practice.
      </div>
    </>
  );
}
