import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getProSubscription } from "@/server/platform/pro";
import { getCustomTestOptions, listCustomTests } from "@/server/platform/custom-tests";
import { CustomTestBuilder } from "@/components/platform/app/CustomTestBuilder";
import { ProUpsell } from "@/components/platform/app/ProUpsell";
import { formatDate, percent, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Custom tests" };

const statusLabel: Record<string, string> = {
  SCHEDULED: "Ready",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  MISSED: "Not submitted",
};

const statusTone: Record<string, string> = {
  SCHEDULED: "tp-pill-brand",
  IN_PROGRESS: "tp-pill-warn",
  SUBMITTED: "tp-pill-ok",
  MISSED: "tp-pill-danger",
};

export default async function PracticePage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head"><div><div className="tp-eyebrow">Practice</div><h1>Choose an exam first</h1></div></div>
        <div className="tp-empty">
          <h3>No exam in your plan</h3>
          <p>Custom tests are drawn from the reviewed bank of an exam in your plan.</p>
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
            <h1>Custom tests</h1>
            <p>Build a paper from the subjects, topics and difficulty you want to work on.</p>
          </div>
          <span className="tp-pill">Free plan</span>
        </div>
        <ProUpsell
          title="Custom tests are part of Pro"
          body="Pick the subjects and difficulty, set the question count and clock, and practise exactly what you need. Up to five custom tests a day, marked with the same deterministic scoring as every daily paper."
          points={["Choose subjects, topic and difficulty", "5 to 50 questions at a time", "Up to 5 custom tests a day", "Results and explanations in the normal review flow"]}
        />
        <section className="tp-card tp-card-pad tp-mt-24">
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>What a custom test uses</h2>
          <p className="tp-small tp-muted">
            Every question comes from the same reviewed {exam.shortName ?? exam.name} bank used by your daily papers.
            A custom test never reuses a question from your last 30 days of papers unless the filter leaves no other
            option, and it never replaces or postpones a daily paper.
          </p>
          <div className="tp-note tp-mt-16">
            <strong>Still in your plan.</strong> Your daily papers keep their official pattern and schedule. Custom
            tests are extra practice on top of them.
          </div>
        </section>
      </>
    );
  }

  const [options, tests] = await Promise.all([
    getCustomTestOptions(user.id, exam),
    listCustomTests(user.id, exam.examId),
  ]);

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.shortName ?? exam.name} · {options.remainingToday} of 5 left today</div>
          <h1>Custom tests</h1>
          <p>Pick what to practise. The server selects the questions and marks the paper deterministically.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pro-badge"><Icon name="crown" size={13} /> Pro</span>
          <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/daily">Daily exams</Link>
        </div>
      </div>

      <CustomTestBuilder
        code={exam.code}
        name={exam.shortName ?? exam.name}
        options={options}
        positiveMarks={exam.positiveMarks}
        negativeMarks={exam.negativeMarks}
      />

      <section className="tp-mt-28">
        <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 20 }}>Your custom tests</h2>
          {tests.length ? <span className="tp-pill">{tests.length}</span> : null}
        </div>
        {tests.length ? (
          <div className="tp-table-wrap">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Paper</th>
                  <th>Questions</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => {
                  const submitted = test.attempt?.status === "SUBMITTED";
                  const score = submitted ? percent(toNumber(test.attempt?.obtainedMarks), toNumber(test.attempt?.totalMarks)) : 0;
                  return (
                    <tr key={test.id}>
                      <td className="tp-nowrap">{formatDate(test.scheduledDate, { day: "numeric", month: "short" })}</td>
                      <td>{test.title}</td>
                      <td>{test.questionIds.length}</td>
                      <td><span className={`tp-pill ${statusTone[test.status] ?? ""}`}>{statusLabel[test.status] ?? test.status}</span></td>
                      <td>{submitted ? `${toNumber(test.attempt?.obtainedMarks)} / ${toNumber(test.attempt?.totalMarks)}` : "—"}</td>
                      <td>{submitted ? `${score.toFixed(0)}% · ${toNumber(test.attempt?.accuracy).toFixed(1)}%` : "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        {submitted ? (
                          <Link className="tp-btn tp-btn-soft tp-btn-sm" href={`/app/daily/${test.id}/result`}>Result</Link>
                        ) : test.status === "MISSED" ? (
                          <span className="tp-xs tp-faint">Closed</span>
                        ) : (
                          <Link className="tp-btn tp-btn-soft tp-btn-sm" href={`/app/daily/${test.id}`}>
                            {test.attempt ? "Resume" : "Open"}
                          </Link>
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
            <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="target" /></span>
            <h3>No custom test yet</h3>
            <p>Build one above. It appears here with its result as soon as you submit it.</p>
          </div>
        )}
      </section>

      <div className="tp-note tp-mt-24">
        <strong>Daily papers are separate.</strong> A custom test does not advance the daily-paper loop, the
        streak, or your missed-paper record.
      </div>
    </>
  );
}
