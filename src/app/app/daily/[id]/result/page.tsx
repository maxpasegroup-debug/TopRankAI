import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/platform/Icon";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/session";
import { getAttemptResult } from "@/server/platform/daily-exam";
import { formatDate, formatDuration, percent } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exam result" };

const statusPill: Record<string, string> = {
  CORRECT: "tp-pill-ok",
  INCORRECT: "tp-pill-danger",
  UNANSWERED: "",
};

function ReviewPager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (target: number) => string;
}) {
  if (totalPages <= 1) return null;
  const numbers: (number | "gap")[] = [];
  for (let value = 1; value <= totalPages; value += 1) {
    const near = Math.abs(value - page) <= 2 || value === 1 || value === totalPages;
    if (near) {
      numbers.push(value);
    } else if (numbers[numbers.length - 1] !== "gap") {
      numbers.push("gap");
    }
  }
  return (
    <nav className="tp-pager" aria-label="Question review pages">
      {page > 1 ? (
        <Link className="tp-pager-link" href={hrefFor(page - 1)} rel="prev">Previous</Link>
      ) : (
        <span className="tp-pager-link" data-disabled="true">Previous</span>
      )}
      {numbers.map((value, index) =>
        value === "gap" ? (
          <span className="tp-pager-gap" key={`gap-${index}`}>…</span>
        ) : (
          <Link
            className="tp-pager-link"
            href={hrefFor(value)}
            key={value}
            aria-current={value === page ? "page" : undefined}
            data-active={value === page ? "true" : undefined}
          >
            {value}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link className="tp-pager-link" href={hrefFor(page + 1)} rel="next">Next</Link>
      ) : (
        <span className="tp-pager-link" data-disabled="true">Next</span>
      )}
    </nav>
  );
}

export default async function DailyExamResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; question?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireAuth();

  const attempt = await prisma.examAttempt.findFirst({
    where: { dailyExamId: id, userId: user.id, status: "SUBMITTED" },
    select: { id: true },
  });
  if (!attempt) redirect(`/app/daily/${id}`);

  let result;
  try {
    result = await getAttemptResult(user.id, attempt.id);
  } catch {
    notFound();
  }

  const { attempt: info, review, subjectBreakdown, topicBreakdown, scorePercent, paperMeta } = result;
  const feedback = info.aiFeedback;
  const topicByName = new Map(review.flatMap((item) => (item.topic ? [[item.topic.title, item.topic] as const] : [])));

  const pageSize = 10;
  const questionIndex = review.findIndex((item) => item.id === query.question);
  const requestedPage = questionIndex >= 0 ? Math.floor(questionIndex / pageSize) + 1 : Number(query.page ?? "1");
  const totalPages = Math.max(1, Math.ceil(review.length / pageSize));
  const page = Math.min(Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1), totalPages);
  const pageStart = (page - 1) * pageSize;
  const pageItems = review.slice(pageStart, pageStart + pageSize);
  const pagerHref = (target: number) => `/app/daily/${id}/result?page=${target}#review`;

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Result · {info.examName}</div>
          <h1>{info.title}</h1>
          <p>
            {formatDate(info.scheduledDate, { weekday: "long", day: "numeric", month: "long" })} · submitted {formatDate(info.submittedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
          {paperMeta ? (
            <div className="tp-row tp-gap-8 tp-wrap" style={{ marginTop: 10 }}>
              <span className={`tp-pill ${paperMeta.mode === "FULL_MOCK" ? "tp-pill-ok" : "tp-pill-warn"}`}>
                {paperMeta.mode === "FULL_MOCK" ? "Full official mock" : "Practice set"}
              </span>
              <span className="tp-pill">
                {paperMeta.mode === "FULL_MOCK"
                  ? `${paperMeta.officialTotal} questions · official pattern`
                  : `${review.length} of ${paperMeta.officialTotal} official questions`}
              </span>
            </div>
          ) : null}
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <Link className="tp-btn tp-btn-ghost" href="/app/daily">All papers</Link>
          <Link className="tp-btn" href="/app/analytics">Analytics <Icon name="arrow-right" size={15} /></Link>
        </div>
      </div>

      <section className="tp-result-hero">
        <div
          className="tp-result-ring"
          style={{ ["--tp-ring" as string]: `${Math.max(scorePercent, 2)}%` }}
          aria-label={`${scorePercent}% score`}
        >
          <div className="tp-result-ring-inner">
            <strong>{scorePercent.toFixed(0)}%</strong>
            <span>score</span>
          </div>
        </div>
        <div>
          <span className={`tp-pill ${scorePercent >= 60 ? "tp-pill-ok" : scorePercent >= 35 ? "tp-pill-warn" : "tp-pill-danger"}`}>
            {scorePercent >= 60 ? "On track" : scorePercent >= 35 ? "Needs work" : "Below target"}
          </span>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 32px)", margin: "12px 0 8px" }}>
            {info.obtainedMarks} of {info.totalMarks} marks
          </h2>
          <p className="tp-small tp-muted" style={{ maxWidth: 560 }}>
            {feedback?.summary ?? `You answered ${info.correctCount} correctly and ${info.incorrectCount} incorrectly, with ${info.unansweredCount} left blank.`}
          </p>
          <div className="tp-result-facts">
            <span className="tp-result-fact">Accuracy <b>{info.accuracy.toFixed(1)}%</b></span>
            <span className="tp-result-fact">Correct <b>{info.correctCount}</b></span>
            <span className="tp-result-fact">Incorrect <b>{info.incorrectCount}</b></span>
            <span className="tp-result-fact">Unanswered <b>{info.unansweredCount}</b></span>
            <span className="tp-result-fact">Negative <b>−{info.negativeMarks}</b></span>
            <span className="tp-result-fact">Time <b>{formatDuration(info.timeTakenSeconds)}</b> of {info.durationMinutes}m</span>
          </div>
        </div>
      </section>

      <div className="tp-grid tp-grid-2 tp-mt-24" style={{ alignItems: "stretch" }}>
        <section className="tp-card tp-card-pad">
          <div className="tp-row-between" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 17 }}>Subject breakdown</h3>
            <span className="tp-xs tp-faint">Calculated on the server</span>
          </div>
          {subjectBreakdown.length ? (
            <div className="tp-stack tp-gap-12">
              {subjectBreakdown.map((subject) => {
                const answered = subject.correct + subject.incorrect;
                const accuracy = answered ? (subject.correct / answered) * 100 : 0;
                return (
                  <div key={subject.name}>
                    <div className="tp-row-between tp-small">
                      <span style={{ fontWeight: 600 }}>{subject.name}</span>
                      <span className="tp-faint">{subject.correct}/{subject.correct + subject.incorrect + subject.unanswered} correct · {accuracy.toFixed(0)}%</span>
                    </div>
                    <div className="tp-meter tp-mt-8"><span style={{ width: `${percent(subject.correct, subject.total)}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="tp-small tp-muted">No subject data recorded for this paper.</p>
          )}
        </section>

        <section className="tp-card tp-card-pad">
          <div className="tp-row-between" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 17 }}>Topic focus</h3>
            <Link className="tp-link tp-small" href="/app/analytics">Full report</Link>
          </div>
          {topicBreakdown.length ? (
            <div className="tp-stack tp-gap-12">
              {topicBreakdown.slice(0, 6).map((topic) => {
                const answered = topic.correct + topic.incorrect;
                const accuracy = answered ? (topic.correct / answered) * 100 : 0;
                return (
                  <div className="tp-progress-row" key={topic.title} style={{ borderBottom: 0, padding: 0 }}>
                    <div className="tp-row-between tp-small">
                      <span style={{ fontWeight: 600 }}>{topic.title}</span>
                      <span className={`tp-pill ${accuracy >= 70 ? "tp-pill-ok" : accuracy >= 40 ? "tp-pill-warn" : "tp-pill-danger"}`}>{accuracy.toFixed(0)}%</span>
                    </div>
                    <div className="tp-xs tp-faint">{topic.correct} correct · {topic.incorrect} incorrect · {topic.unanswered} skipped</div>
                    {topicByName.get(topic.title) ? (
                      <Link className="tp-link tp-xs" href={topicByName.get(topic.title)!.href} style={{ display: "inline-block", marginTop: 6 }}>
                        Revise this topic <Icon name="arrow-right" size={12} />
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="tp-small tp-muted">No topic data recorded.</p>
          )}
        </section>
      </div>

      {feedback ? (
        <section className="tp-card tp-card-pad tp-mt-24">
          <div className="tp-row-between" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 18 }}>{feedback.headline}</h3>
              <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>
                {info.feedbackSource === "AI"
                  ? "Generated by the configured AI provider from the numbers above."
                  : "Built by a deterministic rule set from the numbers above. No AI provider was used."}
              </p>
            </div>
            <span className={`tp-pill ${info.feedbackSource === "AI" ? "tp-pill-brand" : ""}`}>
              <Icon name={info.feedbackSource === "AI" ? "spark" : "shield"} size={13} />
              {info.feedbackSource === "AI" ? "AI-assisted feedback" : "Deterministic feedback"}
            </span>
          </div>
          <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
            <div>
              {feedback.strengths.length ? (
                <>
                  <h4 className="tp-label" style={{ marginBottom: 8 }}>What went well</h4>
                  <ul className="tp-stack tp-gap-8" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {feedback.strengths.map((item) => (
                      <li className="tp-row tp-gap-8 tp-small" key={item} style={{ alignItems: "flex-start" }}>
                        <span style={{ color: "var(--tp-ok)", marginTop: 1 }}><Icon name="check" size={15} /></span>
                        <span className="tp-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {feedback.nextSteps.length ? (
                <>
                  <h4 className="tp-label" style={{ margin: "16px 0 8px" }}>Next steps</h4>
                  <ul className="tp-stack tp-gap-8" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {feedback.nextSteps.map((item) => (
                      <li className="tp-row tp-gap-8 tp-small" key={item} style={{ alignItems: "flex-start" }}>
                        <span style={{ color: "var(--tp-brand)", marginTop: 1 }}><Icon name="arrow-right" size={15} /></span>
                        <span className="tp-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <div>
              {feedback.focusAreas.length ? (
                <>
                  <h4 className="tp-label" style={{ marginBottom: 8 }}>Focus areas</h4>
                  <div className="tp-stack tp-gap-8">
                    {feedback.focusAreas.map((area) => (
                      <div className="tp-note" key={area.topic}>
                        <strong>{area.topic}</strong>
                        <div style={{ marginTop: 4 }}>{area.why}</div>
                        <div style={{ marginTop: 4, color: "var(--tp-brand)" }}>{area.action}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="tp-mt-32" id="review">
        <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>Question review</h2>
            <p className="tp-xs tp-faint" style={{ marginTop: 4 }}>
              Showing {pageStart + 1}–{Math.min(review.length, pageStart + pageSize)} of {review.length} questions
            </p>
          </div>
          <ReviewPager page={page} totalPages={totalPages} hrefFor={pagerHref} />
        </div>
        <div className="tp-card tp-card-pad">
          {pageItems.map((item) => (
            <article className="tp-review-item" id={`answer-${item.id}`} key={item.id}>
              <div className="tp-review-head">
                <span className="tp-review-num">{item.position}</span>
                <div className="tp-grow">
                  <div className="tp-row tp-gap-8 tp-wrap" style={{ marginBottom: 8 }}>
                    <span className="tp-pill">{item.subject}</span>
                    {item.section ? <span className="tp-pill tp-pill-accent">{item.section}</span> : null}
                    {item.topic ? <span className="tp-pill">{item.topic.title}</span> : null}
                    <span className={`tp-pill ${statusPill[item.status] ?? ""}`}>{item.status.toLowerCase()}</span>
                    <span className="tp-pill">{item.marksAwarded > 0 ? `+${item.marksAwarded}` : item.marksAwarded}</span>
                    {item.flagged ? <span className="tp-pill tp-pill-warn"><Icon name="flag" size={12} /> flagged</span> : null}
                  </div>
                  <p className="tp-question-text" style={{ fontSize: 16 }}>{item.text}</p>

                  {item.type === "NUMERICAL" ? (
                    <div className="tp-note tp-mt-16">
                      <strong>Correct answer:</strong> {item.numericalAnswer ?? "—"}
                      <div style={{ marginTop: 4 }}>
                        <strong>Your answer:</strong> {item.selected[0] ?? "Not answered"}
                      </div>
                    </div>
                  ) : (
                    <div className="tp-options">
                      {item.options.map((option, optionIndex) => {
                        const selected = item.selected.includes(option.id);
                        const status = option.isCorrect ? "correct" : selected ? "wrong" : undefined;
                        return (
                          <div className="tp-option" key={option.id} data-status={status} data-selected={selected && !option.isCorrect}>
                            <span className="tp-option-key">{String.fromCharCode(65 + optionIndex)}</span>
                            <span className="tp-option-text">{option.text}</span>
                            {option.isCorrect ? <span className="tp-pill tp-pill-ok" style={{ marginLeft: "auto" }}>Correct</span> : selected ? <span className="tp-pill tp-pill-danger" style={{ marginLeft: "auto" }}>Your answer</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {item.explanation ? (
                    <div className="tp-explain">
                      <strong>Explanation</strong>
                      {item.explanation}
                    </div>
                  ) : null}

                  {item.topic ? (
                    <div className="tp-note tp-mt-16">
                      <div className="tp-row-between tp-gap-12 tp-wrap">
                        <div>
                          <strong>{item.topic.inferred ? "Closest syllabus topic for this question" : "Revise the syllabus behind this question"}</strong>
                          <div className="tp-xs tp-muted" style={{ marginTop: 3 }}>
                            {item.topic.unit} › {item.topic.chapter} › {item.topic.title}
                          </div>
                        </div>
                        <Link className="tp-btn tp-btn-soft tp-btn-sm" href={item.topic.href}>
                          Revise this topic <Icon name="arrow-right" size={14} />
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
        {totalPages > 1 ? (
          <div className="tp-row-between tp-gap-12 tp-wrap tp-mt-16">
            <span className="tp-xs tp-faint">Page {page} of {totalPages}</span>
            <ReviewPager page={page} totalPages={totalPages} hrefFor={pagerHref} />
          </div>
        ) : null}
      </section>

      <div className="tp-note tp-mt-24">
        <strong>Every wrong answer enters revision.</strong> Incorrect questions are scheduled in your revision
        queue with a due date. <Link className="tp-link" href="/app/planner">Open the planner</Link> to clear them.
      </div>
    </>
  );
}
