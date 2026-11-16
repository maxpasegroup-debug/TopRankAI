import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { PrepareExamButton } from "@/components/platform/app/PrepareExamButton";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getDashboardData } from "@/server/platform/candidate";
import { readPaperMeta } from "@/server/platform/daily-exam";
import { getReadiness } from "@/server/platform/insights";
import { sectionMarkLabel } from "@/server/platform/patterns";
import { formatDate, levelLabel, percent, toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const active = await getActiveExam(user.id);
  const data = await getDashboardData(user.id, active?.code ?? null);

  if (!data.selected) {
    return (
      <>
        <div className="tp-page-head">
          <div>
            <div className="tp-eyebrow">Workspace</div>
            <h1>{greeting()}, {user.name.split(" ")[0]}</h1>
            <p>Your account is ready. Add at least one exam to unlock the daily loop.</p>
          </div>
        </div>
        <div className="tp-empty">
          <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="target" /></span>
          <h3>No exam in your plan yet</h3>
          <p>Choose the exams you are preparing for and set a preparation level for each. The daily paper is built from that plan.</p>
          <Link className="tp-btn" href="/app/exams">Choose exams <Icon name="arrow-right" size={16} /></Link>
        </div>
      </>
    );
  }

  const exam = data.selected;
  const readiness = await getReadiness(user.id, exam);
  const daily = data.dailyExams[0] ?? null;
  const attempt = daily?.attempt ?? null;
  const paperMeta = daily ? readPaperMeta(daily.configSnapshot) : null;
  const official = exam.part;
  const scorePercent = attempt && toNumber(attempt.totalMarks) > 0 ? percent(toNumber(attempt.obtainedMarks), toNumber(attempt.totalMarks)) : 0;
  const goalsDone = data.goals.filter((goal) => goal.completedAt).length;
  const nextEvent = data.nextEvent;
  const lastPerformance = data.performance.slice(-12);

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.category ?? "Your plan"} · {levelLabel(exam.level)}</div>
          <h1>{greeting()}, {user.name.split(" ")[0]}</h1>
          <p>{formatDate(data.today, { weekday: "long", day: "numeric", month: "long" })} · {exam.shortName ?? exam.name}</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill tp-pill-brand"><Icon name="target" size={14} /> {levelLabel(exam.level)}</span>
          <span className="tp-pill"><Icon name="flame" size={14} /> {data.streak}-day streak</span>
        </div>
      </div>

      <div className="tp-dash">
        <div className="tp-stack tp-gap-20">
          <section className="tp-daily-card">
            <div className="tp-row-between">
              <span className="tp-eyebrow">Daily paper{paperMeta ? ` · ${paperMeta.mode === "FULL_MOCK" ? "full official mock" : "practice set"}` : ""}</span>
              <span className="tp-pill tp-pill-accent">
                {daily ? `${daily.durationMinutes} min` : `${official?.durationMinutes ?? exam.dailyTestMinutes} min`}
              </span>
            </div>

            {!daily ? (
              <>
                <h2>Your daily paper is not prepared yet.</h2>
                <p className="tp-small tp-muted" style={{ maxWidth: 520 }}>
                  It is assembled from the reviewed {exam.shortName ?? exam.name} question bank and follows your
                  official pattern — {official ? `${official.totalQuestions} questions in ${official.durationMinutes} minutes` : `${exam.dailyTestQuestions} questions`},
                  +{exam.positiveMarks} for a correct answer and −{exam.negativeMarks} for a wrong one. When the bank
                  covers the full paper you get a complete mock; otherwise you get a substantial practice set and the
                  page tells you how much of the official pattern it covers.
                </p>
                <div className="tp-daily-facts">
                  <span className="tp-daily-fact"><Icon name="layers" />{official ? `${official.totalQuestions} official questions` : `${exam.dailyTestQuestions} questions`}</span>
                  <span className="tp-daily-fact"><Icon name="clock" />{official ? `${official.durationMinutes} minutes` : `${exam.dailyTestMinutes} minutes`}</span>
                  <span className="tp-daily-fact"><Icon name="target" />{official ? `${official.totalMarks} marks` : `${levelLabel(exam.level)} level`}</span>
                </div>
                <PrepareExamButton code={exam.code} />
              </>
            ) : attempt?.status === "SUBMITTED" ? (
              <>
                <h2>Today&apos;s daily paper is complete.</h2>
                <p className="tp-small tp-muted" style={{ maxWidth: 520 }}>
                  You scored {toNumber(attempt.obtainedMarks)} out of {toNumber(attempt.totalMarks)} marks at{" "}
                  {toNumber(attempt.accuracy).toFixed(1)}% accuracy. The result and every explanation are ready.
                </p>
                <div className="tp-daily-facts">
                  <span className="tp-daily-fact"><Icon name="check" />{scorePercent.toFixed(0)}% score</span>
                  <span className="tp-daily-fact"><Icon name="target" />{toNumber(attempt.accuracy).toFixed(0)}% accuracy</span>
                  <span className="tp-daily-fact"><Icon name="book" />Review explanations</span>
                </div>
                <div className="tp-row tp-gap-12 tp-wrap">
                  <Link className="tp-btn tp-btn-lg" href={`/app/daily/${daily.id}/result`}>
                    View result <Icon name="arrow-right" size={16} />
                  </Link>
                  <Link className="tp-btn tp-btn-ghost tp-btn-lg" href="/app/daily">Past papers</Link>
                </div>
              </>
            ) : (
              <>
                <h2>{attempt ? "Your paper is in progress." : "Today's daily paper is ready."}</h2>
                <p className="tp-small tp-muted" style={{ maxWidth: 520 }}>
                  {attempt
                    ? "The timer is running from when you started. Resume and submit before it expires."
                    : paperMeta?.mode === "FULL_MOCK"
                      ? `A complete ${daily.questionIds.length}-question mock on the official pattern, timed at ${daily.durationMinutes} minutes. The score is calculated on the server the moment you submit.`
                      : `A ${daily.questionIds.length}-question practice set drawn from the reviewed bank, timed at ${daily.durationMinutes} minutes.${paperMeta ? ` It covers ${daily.questionIds.length} of the ${paperMeta.officialTotal} official questions.` : ""} The score is calculated on the server the moment you submit.`}
                </p>
                <div className="tp-daily-facts">
                  <span className="tp-daily-fact"><Icon name="layers" />{daily.questionIds.length} questions</span>
                  <span className="tp-daily-fact"><Icon name="clock" />{daily.durationMinutes} minutes</span>
                  <span className="tp-daily-fact"><Icon name="target" />{toNumber(daily.totalMarks)} total marks</span>
                </div>
                <Link className="tp-btn tp-btn-lg" href={`/app/daily/${daily.id}`}>
                  {attempt ? "Resume paper" : "Start paper"} <Icon name="play" size={15} />
                </Link>
              </>
            )}
          </section>

          <div className="tp-grid tp-grid-3">
            <div className="tp-stat">
              <div className="tp-stat-label"><Icon name="book" size={15} /> Syllabus</div>
              <div className="tp-stat-value">{data.syllabus.percent}%<small> covered</small></div>
              <div className="tp-meter tp-mt-8"><span style={{ width: `${data.syllabus.percent}%` }} /></div>
              <div className="tp-stat-note">{data.syllabus.completed} of {data.syllabus.total} topics complete</div>
            </div>
            <div className="tp-stat">
              <div className="tp-stat-label"><Icon name="refresh" size={15} /> Revision due</div>
              <div className="tp-stat-value">{data.revisionDue}<small> items</small></div>
              <div className="tp-stat-note">
                {data.revisionDue ? "Wrong answers waiting for review today." : "Nothing overdue. Keep it that way."}
              </div>
              <Link className="tp-btn tp-btn-soft tp-btn-sm tp-mt-8" href="/app/planner">Open planner</Link>
            </div>
            <div className="tp-stat">
              <div className="tp-stat-label"><Icon name="trophy" size={15} /> Achievements</div>
              <div className="tp-stat-value">{data.achievements.earned}<small> / {data.achievements.total}</small></div>
              <div className="tp-meter tp-meter-accent tp-mt-8"><span style={{ width: `${percent(data.achievements.earned, data.achievements.total)}%` }} /></div>
              <Link className="tp-btn tp-btn-soft tp-btn-sm tp-mt-8" href="/app/achievements">View badges</Link>
            </div>
          </div>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>Today&apos;s goals</h3>
                <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>{goalsDone} of {data.goals.length} complete</p>
              </div>
              <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/planner">Planner</Link>
            </div>
            {data.goals.length ? (
              <div>
                {data.goals.map((goal) => (
                  <div className="tp-goal" key={goal.id}>
                    <span className="tp-goal-check" data-done={Boolean(goal.completedAt)}>
                      <Icon name={goal.completedAt ? "check" : "clock"} />
                    </span>
                    <div className="tp-grow">
                      <div className="tp-goal-title">{goal.title}</div>
                      <div className="tp-goal-meta">{goal.progress} of {goal.target} · {goal.type.toLowerCase()}</div>
                      <div className="tp-meter tp-mt-8"><span style={{ width: `${percent(goal.progress, goal.target)}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tp-small tp-muted">
                Goals appear once today&apos;s paper is prepared. They track questions answered, revision cleared
                and study minutes.
              </p>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 6 }}>
              <h3 style={{ fontSize: 17 }}>Recent papers</h3>
              <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/daily">All papers</Link>
            </div>
            {data.recentAttempts.length ? (
              <div className="tp-activity">
                {data.recentAttempts.map((item) => (
                  <div className="tp-activity-row" key={item.id}>
                    <div className="tp-activity-badge">{toNumber(item.obtainedMarks)}</div>
                    <div className="tp-grow">
                      <div className="tp-activity-title">{item.dailyExam?.title ?? item.exam.name}</div>
                      <div className="tp-activity-meta">
                        {formatDate(item.submittedAt, { day: "numeric", month: "short" })} · {item.correctCount} correct · {item.incorrectCount} wrong · {item.unansweredCount} skipped
                      </div>
                    </div>
                    <div className="tp-activity-score">
                      {toNumber(item.accuracy).toFixed(0)}%<small>accuracy</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tp-small tp-muted">No submitted paper yet. Your first result will appear here.</p>
            )}
          </section>
        </div>

        <aside className="tp-stack tp-gap-20">
          <section className="tp-card tp-card-pad">
            <div className="tp-row-between">
              <h3 style={{ fontSize: 17 }}>Readiness</h3>
              <span className="tp-pill tp-pill-brand">{readiness.score}/100</span>
            </div>
            <div className="tp-row tp-gap-16" style={{ marginTop: 18 }}>
              <div
                className="tp-result-ring"
                style={{ width: 104, height: 104, ["--tp-ring" as string]: `${Math.max(readiness.score, 4)}%` }}
                aria-hidden="true"
              >
                <div className="tp-result-ring-inner">
                  <strong style={{ fontSize: 26 }}>{readiness.score}</strong>
                  <span>/ 100</span>
                </div>
              </div>
              <div className="tp-grow">
                <p className="tp-xs tp-muted" style={{ lineHeight: 1.55 }}>
                  {readiness.answered === 0
                    ? "Readiness starts at zero because no paper has been submitted yet. It moves only on recorded activity."
                    : `${readiness.answered} questions answered with ${readiness.accuracy.toFixed(1)}% accuracy.`}
                </p>
              </div>
            </div>
            <div className="tp-stack tp-gap-12 tp-mt-16">
              {readiness.components.map((component) => (
                <div key={component.key}>
                  <div className="tp-row-between tp-xs" style={{ marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>{component.label}</span>
                    <span className="tp-faint">{component.value}</span>
                  </div>
                  <div className="tp-meter"><span style={{ width: `${Math.min(100, (component.value / (component.key === "accuracy" ? 35 : component.key === "attendance" || component.key === "syllabus" ? 20 : component.key === "volume" ? 15 : 10)) * 100)}%` }} /></div>
                  <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>{component.detail}</div>
                </div>
              ))}
            </div>
            <Link className="tp-btn tp-btn-ghost tp-btn-sm tp-btn-block tp-mt-16" href="/app/analytics">Full analytics</Link>
          </section>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 17 }}>Next exam event</h3>
              <Icon name="calendar" size={17} />
            </div>
            {nextEvent ? (
              <>
                <div className="tp-small" style={{ fontWeight: 650 }}>{nextEvent.title}</div>
                <div className="tp-xs tp-muted" style={{ marginTop: 4 }}>
                  {nextEvent.exam.name} · {formatDate(nextEvent.startDate)}
                </div>
                <span className={`tp-pill ${nextEvent.status === "CONFIRMED" ? "tp-pill-ok" : "tp-pill-warn"} tp-mt-8`}>
                  {nextEvent.status === "CONFIRMED" ? "Confirmed" : "Tentative"}
                </span>
                <Link className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block tp-mt-16" href="/app/calendar">Open calendar</Link>
              </>
            ) : (
              <>
                <p className="tp-small tp-muted">
                  No verified date is recorded for your exams. We do not show guessed dates — the calendar stays
                  honest until an official notification is captured.
                </p>
                {exam.officialUrl ? (
                  <a className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block tp-mt-16" href={exam.officialUrl} target="_blank" rel="noopener noreferrer">
                    Official website <Icon name="arrow-right" size={14} />
                  </a>
                ) : (
                  <Link className="tp-btn tp-btn-soft tp-btn-sm tp-btn-block tp-mt-16" href="/app/calendar">Open calendar</Link>
                )}
              </>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 17 }}>Last two weeks</h3>
              <span className="tp-xs tp-faint">{lastPerformance.length} recorded days</span>
            </div>
            {lastPerformance.length ? (
              <>
                <div className="tp-sparkline" aria-hidden="true">
                  {lastPerformance.map((record) => {
                    const answered = record.correct + record.incorrect;
                    const value = answered ? (record.correct / answered) * 100 : 0;
                    return <span key={record.id} style={{ height: `${Math.max(6, value)}%` }} title={`${formatDate(record.recordDate, { day: "numeric", month: "short" })}: ${value.toFixed(0)}%`} />;
                  })}
                </div>
                <div className="tp-xs tp-faint" style={{ marginTop: 10 }}>
                  Daily accuracy from recorded papers. Empty days are gaps, not zeroes.
                </div>
              </>
            ) : (
              <p className="tp-small tp-muted">No performance recorded yet.</p>
            )}
          </section>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 17 }}>Official pattern</h3>
              {exam.part ? (
                <span className={`tp-pill ${exam.part.verified ? "tp-pill-ok" : "tp-pill-warn"}`}>
                  {exam.part.verified ? "Verified" : "Needs verification"}
                </span>
              ) : null}
            </div>
            {exam.part ? (
              <>
                <div className="tp-small" style={{ fontWeight: 650 }}>{exam.part.name}</div>
                <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>
                  {exam.part.totalQuestions} questions · {exam.part.totalMarks} marks · {exam.part.durationMinutes} min
                </div>
                <div className="tp-stack tp-gap-6 tp-mt-12">
                  {exam.part.sections.map((section) => (
                    <div className="tp-row-between tp-xs" key={section.name}>
                      <span className="tp-muted">{section.name}</span>
                      <span style={{ fontWeight: 600 }}>
                        {section.questionCount} Q · {sectionMarkLabel(section)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="tp-small tp-muted">The official pattern has not been recorded for this exam yet.</p>
            )}
            <div className="tp-note tp-mt-16">
              <strong>Daily paper.</strong> Papers follow the official pattern above.{" "}
              {paperMeta
                ? `Today's is a ${paperMeta.mode === "FULL_MOCK" ? "complete full mock" : "practice set drawn from the reviewed bank"}.`
                : "Today's paper becomes a complete full mock when the reviewed bank covers the whole paper; otherwise it is a clearly labelled practice set."}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
