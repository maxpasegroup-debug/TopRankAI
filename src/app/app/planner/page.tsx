import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { PlanGenerator } from "@/components/platform/app/PlanGenerator";
import { PrepareExamButton } from "@/components/platform/app/PrepareExamButton";
import { RevisionActions } from "@/components/platform/app/RevisionActions";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getPlannerData } from "@/server/platform/insights";
import { formatDate, levelLabel, percent, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planner" };

export default async function PlannerPage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head"><div><div className="tp-eyebrow">Planner</div><h1>Choose an exam first</h1></div></div>
        <div className="tp-empty">
          <h3>No exam in your plan</h3>
          <p>Goals, revision and study plans are built per exam.</p>
          <Link className="tp-btn" href="/app/exams">Choose exams</Link>
        </div>
      </>
    );
  }

  const plan = await getPlannerData(user.id, exam);
  const goalsDone = plan.goals.filter((goal) => goal.completedAt).length;

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.shortName ?? exam.name} · {levelLabel(exam.level)}</div>
          <h1>Planner</h1>
          <p>Today&apos;s goals, the revision queue and a realistic plan for your available time.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill tp-pill-brand"><Icon name="clock" size={14} /> {exam.dailyMinutes} min/day</span>
          {plan.daysToExam !== null ? <span className="tp-pill"><Icon name="calendar" size={14} /> {plan.daysToExam} days to target</span> : <span className="tp-pill">Target date not set</span>}
        </div>
      </div>

      <div className="tp-dash">
        <div className="tp-stack tp-gap-20">
          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>Today&apos;s goals</h3>
                <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>{goalsDone} of {plan.goals.length} complete</p>
              </div>
              <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/daily">Daily paper</Link>
            </div>
            {plan.goals.length ? (
              plan.goals.map((goal) => (
                <div className="tp-goal" key={goal.id}>
                  <span className="tp-goal-check" data-done={Boolean(goal.completedAt)}>
                    <Icon name={goal.completedAt ? "check" : "target"} />
                  </span>
                  <div className="tp-grow">
                    <div className="tp-goal-title">{goal.title}</div>
                    <div className="tp-goal-meta">{goal.progress} of {goal.target} · {goal.type.toLowerCase()}</div>
                    <div className="tp-meter tp-mt-8"><span style={{ width: `${percent(goal.progress, goal.target)}%` }} /></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="tp-stack tp-gap-12">
                <p className="tp-small tp-muted">
                  Goals are generated when today&apos;s paper is prepared. Prepare it to start tracking questions,
                  revision and minutes.
                </p>
                <PrepareExamButton code={exam.code} label="Prepare today's paper" />
              </div>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>Revision queue</h3>
                <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>{plan.dueRevision.length} due today · {plan.revision.length} pending</p>
              </div>
            </div>
            {plan.revision.length ? (
              <div>
                {plan.revision.slice(0, 12).map((item) => {
                  const due = item.dueDate.getTime() <= Date.now();
                  return (
                    <div className="tp-list-item" key={item.id} style={{ alignItems: "flex-start" }}>
                      <span className="tp-activity-badge" style={{ background: due ? "var(--tp-warn-soft)" : "var(--tp-brand-soft)", color: due ? "var(--tp-warn)" : "var(--tp-brand)" }}>
                        <Icon name="refresh" size={16} />
                      </span>
                      <div className="tp-grow">
                        <div className="tp-activity-title" style={{ fontWeight: 600 }}>
                          {item.topic?.title ?? (item.question ? `${item.question.subject.name} revision` : "Revision item")}
                        </div>
                        <div className="tp-activity-meta" style={{ marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {item.question?.text ?? "Question no longer published"}
                        </div>
                        <div className="tp-xs tp-faint" style={{ marginTop: 4 }}>
                          {item.reason} · due {formatDate(item.dueDate, { day: "numeric", month: "short" })}
                        </div>
                      </div>
                      <RevisionActions id={item.id} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="tp-small tp-muted">Nothing in the revision queue. Incorrect answers from a daily paper are added automatically.</p>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 17 }}>Suggested study plan</h3>
              <PlanGenerator code={exam.code} />
            </div>
            <p className="tp-small tp-muted">
              Built from your recorded weak topics and the {exam.dailyMinutes} minutes you set aside each day.
            </p>
            {plan.plan ? (
              <div className="tp-note tp-mt-16">
                <strong>Base plan.</strong> {plan.plan.focus} — {plan.plan.rationale}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="tp-stack tp-gap-20">
          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Weakest topics</h3>
            {plan.weakest.length ? (
              <div className="tp-stack tp-gap-12">
                {plan.weakest.map((topic) => (
                  <div key={topic.title}>
                    <div className="tp-row-between tp-small">
                      <span style={{ fontWeight: 600 }}>{topic.title}</span>
                      <span className={`tp-pill ${topic.accuracy >= 60 ? "tp-pill-warn" : "tp-pill-danger"}`}>{topic.accuracy.toFixed(0)}%</span>
                    </div>
                    <div className="tp-meter tp-mt-8"><span style={{ width: `${topic.accuracy}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tp-small tp-muted">Enough topic data is collected after a few papers.</p>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>Next exam event</h3>
            {plan.nextEvent ? (
              <>
                <div className="tp-small" style={{ fontWeight: 650 }}>{plan.nextEvent.title}</div>
                <div className="tp-xs tp-muted" style={{ marginTop: 4 }}>{formatDate(plan.nextEvent.startDate)} · {plan.nextEvent.status.toLowerCase()}</div>
                <Link className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block tp-mt-16" href="/app/calendar">Calendar</Link>
              </>
            ) : (
              <>
                <p className="tp-small tp-muted">No verified date recorded. We do not invent dates.</p>
                {exam.officialUrl ? (
                  <a className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block tp-mt-16" href={exam.officialUrl} target="_blank" rel="noopener noreferrer">
                    Official website <Icon name="arrow-right" size={14} />
                  </a>
                ) : null}
              </>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>Marking model</h3>
            <div className="tp-stack tp-gap-8">
              <div className="tp-row-between tp-small"><span className="tp-muted">Correct</span><span style={{ fontWeight: 600 }}>+{exam.positiveMarks}</span></div>
              <div className="tp-row-between tp-small"><span className="tp-muted">Incorrect</span><span style={{ fontWeight: 600 }}>−{exam.negativeMarks}</span></div>
              <div className="tp-row-between tp-small"><span className="tp-muted">Unanswered</span><span style={{ fontWeight: 600 }}>0</span></div>
              <div className="tp-row-between tp-small">
                <span className="tp-muted">Official paper</span>
                <span style={{ fontWeight: 600 }}>
                  {exam.part ? `${exam.part.totalQuestions} Q · ${exam.part.durationMinutes} min` : `${toNumber(exam.totalQuestions)} Q`}
                </span>
              </div>
              <div className="tp-row-between tp-small">
                <span className="tp-muted">Daily paper mode</span>
                <span style={{ fontWeight: 600 }}>Full mock or practice set</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
