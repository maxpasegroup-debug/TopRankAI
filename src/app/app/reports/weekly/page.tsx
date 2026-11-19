import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getProSubscription } from "@/server/platform/pro";
import { getWeeklyReport, reportRangeLabel, deltaLabel } from "@/server/platform/reports";
import { ProUpsell } from "@/components/platform/app/ProUpsell";
import { PrintButton } from "@/components/platform/app/PrintButton";
import { formatDate, formatDateTime, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly report card" };

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`tp-stat ${tone === "ok" ? "tp-stat-ok" : tone === "warn" ? "tp-stat-warn" : ""}`}>
      <div className="tp-stat-label">{label}</div>
      <div className="tp-stat-value">{value}</div>
      {note ? <div className="tp-stat-note">{note}</div> : null}
    </div>
  );
}

export default async function WeeklyReportPage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head"><div><div className="tp-eyebrow">Progress</div><h1>Choose an exam first</h1></div></div>
        <div className="tp-empty">
          <h3>No exam in your plan</h3>
          <p>The weekly report card is calculated per exam from submitted papers.</p>
          <Link className="tp-btn" href="/app/exams">Choose exams</Link>
        </div>
      </>
    );
  }

  const pro = await getProSubscription(user.id);

  if (!pro) {
    return (
      <>
        <div className="tp-page-head">
          <div>
            <div className="tp-eyebrow">{exam.shortName ?? exam.name}</div>
            <h1>Weekly report card</h1>
            <p>Seven days of real papers, set against the week before.</p>
          </div>
          <span className="tp-pill">Free plan</span>
        </div>
        <ProUpsell
          title="The weekly report card is part of the paid plans"
          body="A printable seven-day report built from your submitted papers: accuracy, marks, study time, subject movement and the topics that need another pass, with the previous week beside it."
          points={["This week compared with last week", "Subject and weak-topic accuracy", "Every paper listed with its score", "Print or save as a PDF"]}
        />
        <div className="tp-note tp-mt-24">
          The report never estimates a number. A week with no papers is shown as an empty week.
        </div>
      </>
    );
  }

  const report = await getWeeklyReport(user.id, exam);
  const current = report.current;
  const previous = report.previous;
  const rows: { label: string; current: string; previous: string }[] = [
    { label: "Papers submitted", current: String(current.papers), previous: String(previous.papers) },
    { label: "Active days", current: `${current.activeDays} of 7`, previous: `${previous.activeDays} of 7` },
    { label: "Questions seen", current: String(current.questions), previous: String(previous.questions) },
    { label: "Accuracy", current: `${current.accuracy.toFixed(1)}%`, previous: `${previous.accuracy.toFixed(1)}%` },
    { label: "Marks", current: `${current.marksObtained} / ${current.marksTotal}`, previous: `${previous.marksObtained} / ${previous.marksTotal}` },
    { label: "Best score", current: `${current.bestScore.toFixed(0)}%`, previous: `${previous.bestScore.toFixed(0)}%` },
    { label: "Study time", current: `${current.studyMinutes} min`, previous: `${previous.studyMinutes} min` },
    { label: "Negative marks lost", current: String(current.negativeMarks), previous: String(previous.negativeMarks) },
    { label: "Average time per question", current: `${current.averageTimePerQuestion}s`, previous: `${previous.averageTimePerQuestion}s` },
  ];

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.shortName ?? exam.name} · {reportRangeLabel(report)}</div>
          <h1>Weekly report card</h1>
          <p>Every figure comes from submitted papers. The previous week is shown beside it.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <PrintButton />
          <Link className="tp-btn tp-btn-ghost" href="/app/analytics">Full analytics</Link>
        </div>
      </div>

      <div className="tp-report-sheet">
        <header className="tp-report-head">
          <div>
            <span className="tp-pro-badge"><Icon name="crown" size={13} /> Paid plan report</span>
            <h2>{exam.name}</h2>
            <p>{formatDate(report.from, { weekday: "long", day: "numeric", month: "long" })} to {formatDate(report.to, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div className="tp-report-head-meta">
            <span><Icon name="flame" size={14} /> {report.streak}-day streak</span>
            <span><Icon name="check" size={14} /> {current.papers} paper{current.papers === 1 ? "" : "s"} this week</span>
            <span><Icon name="clock" size={14} /> Prepared {formatDateTime(new Date())} IST</span>
          </div>
        </header>

        <section className="tp-report-insight">
          <Icon name="pulse" size={20} />
          <p>{report.insight}</p>
        </section>

        <div className="tp-grid tp-grid-4 tp-mt-20">
          <Stat label="Accuracy" value={`${current.accuracy.toFixed(1)}%`} note={deltaLabel(report.delta.accuracy)} tone={report.delta.accuracy >= 0 ? "ok" : "warn"} />
          <Stat label="Papers" value={String(current.papers)} note={report.delta.papers === 0 ? "Same as last week" : `${report.delta.papers > 0 ? "+" : ""}${report.delta.papers} vs last week`} />
          <Stat label="Marks" value={`${Math.round(current.marksObtained * 100) / 100}`} note={report.delta.marks === 0 ? "Same as last week" : `${report.delta.marks > 0 ? "+" : ""}${Math.round(report.delta.marks * 100) / 100} vs last week`} />
          <Stat label="Active days" value={`${current.activeDays}/7`} note={`${current.studyMinutes} minutes recorded`} />
        </div>

        <section className="tp-report-block">
          <h3>This week against last week</h3>
          <div className="tp-table-wrap" style={{ border: 0 }}>
            <table className="tp-table tp-report-table">
              <thead>
                <tr><th>Measure</th><th>This week</th><th>Previous week</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    <td>{row.current}</td>
                    <td className="tp-faint">{row.previous}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="tp-report-columns">
          <section className="tp-report-block">
            <h3>Subject accuracy</h3>
            {report.subjects.length ? (
              <div className="tp-stack tp-gap-12">
                {report.subjects.map((subject) => (
                  <div key={subject.name}>
                    <div className="tp-row-between tp-small">
                      <span style={{ fontWeight: 600 }}>{subject.name}</span>
                      <span className="tp-faint">{subject.correct}/{subject.total} · {subject.accuracy.toFixed(1)}%</span>
                    </div>
                    <div className={`tp-meter tp-mt-8 ${subject.accuracy >= 60 ? "tp-meter-ok" : "tp-meter-accent"}`}>
                      <span style={{ width: `${subject.accuracy}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tp-small tp-muted">No subject was attempted this week.</p>
            )}
          </section>

          <section className="tp-report-block">
            <h3>Topics to revisit</h3>
            {report.weakTopics.length ? (
              <div className="tp-stack tp-gap-10">
                {report.weakTopics.map((topic) => (
                  <div className="tp-row-between tp-gap-12 tp-small" key={topic.title}>
                    <span style={{ fontWeight: 600 }}>{topic.title}</span>
                    <span className={`tp-pill ${topic.accuracy >= 60 ? "tp-pill-warn" : "tp-pill-danger"}`}>{topic.accuracy.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tp-small tp-muted">A topic needs at least two attempted questions to appear here.</p>
            )}
          </section>
        </div>

        <section className="tp-report-block">
          <h3>Papers this week</h3>
          {report.papers.length ? (
            <div className="tp-table-wrap" style={{ border: 0 }}>
              <table className="tp-table tp-report-table">
                <thead>
                  <tr><th>Date</th><th>Paper</th><th>Marks</th><th>Accuracy</th><th>Correct</th><th>Wrong</th><th>Skipped</th></tr>
                </thead>
                <tbody>
                  {report.papers.map((paper) => (
                    <tr key={paper.id}>
                      <td className="tp-nowrap">{formatDate(paper.submittedAt, { day: "numeric", month: "short" })}</td>
                      <td>{paper.dailyExam?.title ?? "Daily paper"}</td>
                      <td>{toNumber(paper.obtainedMarks)} / {toNumber(paper.totalMarks)}</td>
                      <td>{toNumber(paper.accuracy).toFixed(1)}%</td>
                      <td>{paper.correctCount}</td>
                      <td>{paper.incorrectCount}</td>
                      <td>{paper.unansweredCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="tp-small tp-muted">No paper was submitted in this window.</p>
          )}
        </section>

        <footer className="tp-report-foot">
          <span>TopRank AI · weekly report card</span>
          <span>Generated from {current.papers + previous.papers} submitted paper{current.papers + previous.papers === 1 ? "" : "s"} across two weeks.</span>
        </footer>
      </div>
    </>
  );
}
