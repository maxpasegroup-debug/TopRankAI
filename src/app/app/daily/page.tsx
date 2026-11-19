import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { ExamScheduleList } from "@/components/platform/app/ExamScheduleList";
import { NextPaperNotice } from "@/components/platform/app/NextPaperNotice";
import { ProUpsell } from "@/components/platform/app/ProUpsell";
import { getPaperSchedule } from "@/server/platform/paper-schedule";
import { EXAM_BREAK_MINUTES } from "@/shared/daily-workload";
import { PrepareExamButton } from "@/components/platform/app/PrepareExamButton";
import { requireAuth } from "@/server/auth/session";
import { getCandidateExams, getSelectedExam, computeStreak } from "@/server/platform/candidate";
import { getActiveExam } from "@/server/platform/active";
import { getProSubscription } from "@/server/platform/pro";
import { getDailyHistory, readPaperMeta } from "@/server/platform/daily-exam";import { formatDate, formatDateTime, todayDate, levelLabel, percent, toNumber } from "@/server/platform/utils";

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

export default async function DailyExamsPage({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const user = await requireAuth();
  const code = (await searchParams).exam;
  const exam = code ? await getSelectedExam(user.id, code) : await getActiveExam(user.id);

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

  const day = todayDate();
  const pro = Boolean(await getProSubscription(user.id));
  const [history, schedule, allExams, streak] = await Promise.all([
    getDailyHistory(user.id, exam.examId),
    getPaperSchedule(user.id, exam, day),
    getCandidateExams(user.id),
    computeStreak(user.id, exam.examId),
  ]);
  const todayPapers = history.filter((paper) => paper.scheduledDate.getTime() === day.getTime());
  const submitted = history.filter((item) => item.attempt?.status === "SUBMITTED");
  const bestScore = submitted.reduce((best, item) => Math.max(best, percent(toNumber(item.attempt?.obtainedMarks), toNumber(item.attempt?.totalMarks))), 0);
  const averageAccuracy = submitted.length
    ? submitted.reduce((sum, item) => sum + toNumber(item.attempt?.accuracy), 0) / submitted.length
    : 0;
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
        <span className="tp-pill"><Icon name="flame" size={14} /> {streak}-day streak</span>
      </div>

      {!pro ? (
        <ProUpsell
          compact
          title="Want more than today's papers?"
          body="Riser raises the limit to six papers a day; Scholar and Topper go to eight. Paid plans also add custom tests, report cards and streak freezes."
          points={["Choose your own subject and difficulty", "Report cards and revision sheets", "Up to 4 streak freezes a month"]}
        />
      ) : null}

      <div className="tp-grid tp-grid-3 tp-mb-24">
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="check" size={15} /> Submitted</div>
          <div className="tp-stat-value">{submitted.length}<small> {submitted.length === 1 ? "paper" : "papers"}</small></div>
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

      <NextPaperNotice name={exam.shortName ?? exam.name} schedule={schedule} day={day} startMinutes={exam.dailyStartMinutes} />
      <section className="tp-card tp-card-pad tp-mb-24">
        <h2 style={{ fontSize: 19 }}>Today’s papers</h2>
        <p className="tp-small tp-muted tp-mb-16">
          Every paper is the complete official paper — the same question count, duration and marks as the real exam.
          Allow {EXAM_BREAK_MINUTES} minutes after submitting each paper before the next sitting opens.
        </p>
        {schedule.map((sitting) => {
          const paper = todayPapers.find((entry) => entry.slot === sitting.slot);
          const meta = paper && readPaperMeta(paper.configSnapshot);
          const submitted = paper?.attempt?.status === "SUBMITTED";
          return <div key={sitting.slot} className="tp-list-item tp-row-between">
            <div>
              <h3 style={{ fontSize: 16 }}>Paper {sitting.slot + 1} · {meta ? modeLabel[meta.mode] : "Full official mock"}</h3>
              <p className="tp-xs tp-muted">{submitted ? "Submitted" : paper?.attempt ? "In progress" : sitting.available
                ? "Ready to prepare" : `Planned for ${formatDateTime(sitting.startsAt)} IST`}</p>
            </div>
            {paper && (submitted || paper.attempt || sitting.available) ? (
              <Link className="tp-btn tp-btn-sm" href={`/app/daily/${paper.id}${submitted ? "/result" : ""}`}>
                {submitted ? "Review result" : paper.attempt ? "Resume" : "Open paper"}
              </Link>
            ) : sitting.available ? (
              <PrepareExamButton code={exam.code} slot={sitting.slot} label="Prepare paper" className="tp-btn tp-btn-sm" />
            ) : <span className="tp-pill">{sitting.slot === 0 || schedule[sitting.slot - 1]?.status === "SUBMITTED" ? "Study break" : "After previous paper"}</span>}
          </div>;
        })}
      </section>
      <ExamScheduleList
        activeCode={exam.code}
        rows={allExams.map((entry) => ({
          targetId: entry.targetId,
          code: entry.code,
          name: entry.name,
          count: entry.papersPerDay,
          included: entry.includedPapers,
          durationMinutes: entry.durationMinutes,
          studyMinutes: entry.dailyMinutes,
          startMinutes: entry.dailyStartMinutes ?? 480,
          monthlyUntil: entry.monthlyUntil ? formatDateTime(entry.monthlyUntil) + " IST" : null,
        }))}
      />

      <h2 style={{ fontSize: 20, marginBottom: 14 }}>Paper history</h2>
      {history.length ? (
        <div className="tp-table-wrap">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Paper</th>
                <th>Answered / total</th>
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
                    <td>{submittedPaper ? `${(item.attempt?.correctCount ?? 0) + (item.attempt?.incorrectCount ?? 0)} / ${item.questionIds.length}` : `— / ${item.questionIds.length}`}</td>
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
        </div>
      )}

      <div className="tp-note tp-mt-24">
        <strong>Honest record.</strong> A paper left unsubmitted on its scheduled day is marked missed. It is not
        deleted, and it does not count as practice.
      </div>
    </>
  );
}
