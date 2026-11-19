import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getAnalytics } from "@/server/platform/insights";
import { getProSubscription } from "@/server/platform/pro";
import { ProUpsell } from "@/components/platform/app/ProUpsell";
import { StreakFreezeCard } from "@/components/platform/app/StreakFreezeCard";
import { getFreezeState } from "@/server/platform/streak-freeze";
import { formatDate, levelLabel, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const maxByKey: Record<string, number> = { attendance: 20, accuracy: 35, volume: 15, syllabus: 20, consistency: 10 };

export default async function AnalyticsPage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head"><div><div className="tp-eyebrow">Analytics</div><h1>Choose an exam first</h1></div></div>
        <div className="tp-empty">
          <h3>No exam in your plan</h3>
          <p>Analytics are calculated per exam from your recorded attempts.</p>
          <Link className="tp-btn" href="/app/exams">Choose exams</Link>
        </div>
      </>
    );
  }

  const data = await getAnalytics(user.id, exam);
  const [pro, freeze] = await Promise.all([
    getProSubscription(user.id),
    getFreezeState(user.id, exam.examId),
  ]);
  const trend = data.records.slice(-16);

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.shortName ?? exam.name} · {levelLabel(exam.level)}</div>
          <h1>Analytics</h1>
          <p>Every number below is computed on the server from submitted papers. Nothing here is estimated.</p>
        </div>
        <Link className="tp-btn tp-btn-ghost" href="/app/daily">Daily papers</Link>
      </div>

      <div className="tp-grid tp-grid-4 tp-mb-24">
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="check" size={15} /> Papers submitted</div>
          <div className="tp-stat-value">{data.totalAttempts}</div>
          <div className="tp-stat-note">Across this exam</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="target" size={15} /> Average accuracy</div>
          <div className="tp-stat-value">{data.averageAccuracy.toFixed(1)}<small> %</small></div>
          <div className="tp-stat-note">Correct ÷ attempted</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="star" size={15} /> Best score</div>
          <div className="tp-stat-value">{data.bestScore.toFixed(0)}<small> %</small></div>
          <div className="tp-stat-note">Highest single paper</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-label"><Icon name="clock" size={15} /> Study time</div>
          <div className="tp-stat-value">{Math.round(data.totalStudyMinutes / 60)}<small> h</small></div>
          <div className="tp-stat-note">Recorded in timed papers</div>
        </div>
      </div>

      <div className="tp-dash">
        <div className="tp-stack tp-gap-20">
          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>Score trend</h3>
                <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>{trend.length} recorded day{trend.length === 1 ? "" : "s"}, oldest left</p>
              </div>
              <span className="tp-pill tp-pill-brand">{data.readiness.score}/100 readiness</span>
            </div>
            {trend.length ? (
              <>
                <div className="tp-bars">
                  {trend.map((record) => {
                    const total = toNumber(record.marksTotal);
                    const value = total ? (Math.max(0, toNumber(record.marksObtained)) / total) * 100 : 0;
                    return (
                      <span
                        key={record.id}
                        style={{ height: `${Math.max(4, value)}%` }}
                        title={`${formatDate(record.recordDate, { day: "numeric", month: "short" })}: ${value.toFixed(0)}%`}
                      />
                    );
                  })}
                </div>
                <div className="tp-bars-axis">
                  <span>{formatDate(trend[0]?.recordDate, { day: "numeric", month: "short" })}</span>
                  <span>{formatDate(trend[trend.length - 1]?.recordDate, { day: "numeric", month: "short" })}</span>
                </div>
              </>
            ) : (
              <p className="tp-small tp-muted">Submit a daily paper to start the trend.</p>
            )}
          </section>

          {pro ? (
            <section className="tp-card tp-card-pad tp-advanced">
              <div className="tp-row-between tp-gap-10 tp-wrap" style={{ marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 17 }}>Advanced analytics</h3>
                  <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>Paid plans read the same submitted papers, in more detail.</p>
                </div>
                <span className="tp-pro-badge"><Icon name="crown" size={12} /> Paid plan</span>
              </div>
              <div className="tp-grid tp-grid-2">
                <div className="tp-advanced-stat">
                  <span className="tp-advanced-label"><Icon name="alert" size={14} /> Negative marks lost</span>
                  <strong>{data.negativeMarksLost}</strong>
                  <p>Total marks deducted for wrong answers across every submitted paper.</p>
                </div>
                <div className="tp-advanced-stat">
                  <span className="tp-advanced-label"><Icon name="clock" size={14} /> Average time per question</span>
                  <strong>{data.averageTimePerQuestion}s</strong>
                  <p>Total time in papers divided by every question you saw.</p>
                </div>
              </div>
              <div className="tp-mt-16">
                <div className="tp-row-between" style={{ marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14 }}>Subject momentum</h4>
                  <span className="tp-xs tp-faint">Last 5 papers vs the 5 before</span>
                </div>
                {data.subjectMomentum.length ? (
                  <div className="tp-stack tp-gap-10">
                    {data.subjectMomentum.map((subject) => (
                      <div className="tp-row-between tp-gap-12 tp-small" key={subject.name}>
                        <span style={{ fontWeight: 600 }}>{subject.name}</span>
                        <span className="tp-row tp-gap-8">
                          <span className="tp-faint">{subject.earlier.toFixed(1)}% → {subject.recent.toFixed(1)}%</span>
                          <span className={`tp-pill ${subject.delta > 0 ? "tp-pill-ok" : subject.delta < 0 ? "tp-pill-danger" : ""}`}>
                            {subject.delta > 0 ? "+" : ""}{subject.delta.toFixed(1)} pt
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="tp-small tp-muted">A subject needs at least two answered questions in both five-paper windows.</p>
                )}
              </div>
            </section>
          ) : (
            <ProUpsell
              compact
              title="Advanced analytics with a paid plan"
              body="See negative marks lost, average time per question and which subjects are moving up or down over your last ten papers."
            />
          )}

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 17, marginBottom: 14 }}>Subject accuracy</h3>            {data.subjects.length ? (
              <div className="tp-stack tp-gap-14">
                {data.subjects.map((subject) => (
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
              <p className="tp-small tp-muted">Subject data appears after your first submitted paper.</p>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 17, marginBottom: 14 }}>Recent papers</h3>
            {data.attempts.length ? (
              <div className="tp-table-wrap" style={{ border: 0 }}>
                <table className="tp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Score</th>
                      <th>Accuracy</th>
                      <th>Correct</th>
                      <th>Wrong</th>
                      <th>Skipped</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.attempts.slice(0, 12).map((attempt) => (
                      <tr key={attempt.id}>
                        <td className="tp-nowrap">{formatDate(attempt.submittedAt, { day: "numeric", month: "short" })}</td>
                        <td>{toNumber(attempt.scorePercent).toFixed(0)}%</td>
                        <td>{toNumber(attempt.accuracy).toFixed(1)}%</td>
                        <td>{attempt.correctCount}</td>
                        <td>{attempt.incorrectCount}</td>
                        <td>{attempt.unansweredCount}</td>
                        <td style={{ textAlign: "right" }}>
                          {attempt.dailyExam ? (
                            <Link className="tp-btn tp-btn-soft tp-btn-sm" href={`/app/daily/${attempt.dailyExam.id}/result`}>Result</Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="tp-small tp-muted">No submitted papers yet.</p>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 17, marginBottom: 10 }}>Question bank</h3>
            <p className="tp-small tp-muted">
              {data.totalQuestions} reviewed questions are published for this exam. The daily paper rotates
              deterministically through them.
            </p>
            <div className="tp-xs tp-faint tp-mt-8">Accuracy is always correct ÷ attempted, never inflated by skipped questions.</div>
          </section>
        </div>

        <aside className="tp-stack tp-gap-20">
          <StreakFreezeCard
            state={{
              code: exam.code,
              pro: freeze.pro,
              allowance: freeze.allowance,
              used: freeze.used,
              remaining: freeze.remaining,
              frozenDates: freeze.frozenDates.map((item) => ({
                date: formatDate(item.date, { day: "numeric", month: "short" }),
                createdAt: formatDate(item.createdAt, { day: "numeric", month: "short" }),
              })),
              yesterday: formatDate(freeze.yesterday, { day: "numeric", month: "short" }),
              canProtectYesterday: freeze.canProtectYesterday,
              reason: freeze.reason,
            }}
          />

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 17 }}>Readiness breakdown</h3>
              <span className="tp-pill tp-pill-brand">{data.readiness.score}/100</span>
            </div>
            <div className="tp-stack tp-gap-12">
              {data.readiness.components.map((component) => (
                <div key={component.key}>
                  <div className="tp-row-between tp-xs" style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{component.label}</span>
                    <span className="tp-faint">{component.value}/{maxByKey[component.key] ?? 20}</span>
                  </div>
                  <div className="tp-meter"><span style={{ width: `${Math.min(100, (component.value / (maxByKey[component.key] ?? 20)) * 100)}%` }} /></div>
                  <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>{component.detail}</div>
                </div>
              ))}
            </div>
            <div className="tp-note tp-mt-16">
              Readiness weights: attendance 20, accuracy 35, question volume 15, syllabus 20, streak 10.
            </div>
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>Weakest topics</h3>
            {data.weakTopics.length ? (
              <div className="tp-stack tp-gap-12">
                {data.weakTopics.map((topic) => (
                  <div key={topic.title}>
                    <div className="tp-row-between tp-small">
                      <span style={{ fontWeight: 600 }}>{topic.title}</span>
                      <span className={`tp-pill ${topic.accuracy >= 60 ? "tp-pill-warn" : "tp-pill-danger"}`}>{topic.accuracy.toFixed(0)}%</span>
                    </div>
                    <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>{topic.correct} correct of {topic.total} attempted</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tp-small tp-muted">A topic needs at least two attempts before it appears here.</p>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 17, marginBottom: 10 }}>Syllabus coverage</h3>
            <div className="tp-stat-value" style={{ fontSize: 26 }}>{data.readiness.syllabus.percent}%</div>
            <div className="tp-meter tp-mt-8"><span style={{ width: `${data.readiness.syllabus.percent}%` }} /></div>
            <div className="tp-xs tp-faint tp-mt-8">{data.readiness.syllabus.completed} of {data.readiness.syllabus.total} topics complete</div>
            <Link className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block tp-mt-16" href="/app/learn">Open learning centre</Link>
          </section>

        </aside>
      </div>
    </>
  );
}
