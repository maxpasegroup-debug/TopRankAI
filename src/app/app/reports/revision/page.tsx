import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getProSubscription } from "@/server/platform/pro";
import { getRevisionSheet } from "@/server/platform/reports";
import { ProUpsell } from "@/components/platform/app/ProUpsell";
import { PrintButton } from "@/components/platform/app/PrintButton";
import { formatDate, formulaText } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revision sheet" };

export default async function RevisionSheetPage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head"><div><div className="tp-eyebrow">Progress</div><h1>Choose an exam first</h1></div></div>
        <div className="tp-empty">
          <h3>No exam in your plan</h3>
          <p>The revision sheet is built from your answers for the active exam.</p>
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
            <h1>Formula and mistake sheet</h1>
            <p>One printable sheet with the formulas you need and the questions you got wrong.</p>
          </div>
          <span className="tp-pill">Free plan</span>
        </div>
        <ProUpsell
          title="The revision sheet is part of the paid plans"
          body="Your last 30 days of wrong answers, grouped by topic with the correct answer and explanation, followed by the exam's published formulas. Print it or save it as a PDF before a revision sitting."
          points={["Every incorrect answer with the explanation", "Mistakes grouped by topic", "Formulas from the exam syllabus", "Print or save as a PDF"]}
        />
        <div className="tp-note tp-mt-24">
          Nothing is invented for the sheet. It uses the questions you actually answered wrong and the formulas
          recorded in the syllabus.
        </div>
      </>
    );
  }

  const sheet = await getRevisionSheet(user.id, exam, 30);
  const bySubject = new Map<string, { chapter: string; formulas: { id: string; title: string; formulas: string }[] }[]>();
  for (const formula of sheet.formulas) {
    const chapters = bySubject.get(formula.subject) ?? [];
    const existing = chapters.find((chapter) => chapter.chapter === formula.chapter);
    const entry = { id: formula.id, title: formula.title, formulas: formula.formulas };
    if (existing) existing.formulas.push(entry);
    else chapters.push({ chapter: formula.chapter, formulas: [entry] });
    bySubject.set(formula.subject, chapters);
  }

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.shortName ?? exam.name} · last {sheet.windowDays} days</div>
          <h1>Formula and mistake sheet</h1>
          <p>{sheet.mistakes.length} wrong answer{sheet.mistakes.length === 1 ? "" : "s"} across {sheet.papers} paper{sheet.papers === 1 ? "" : "s"} · {sheet.marksLost} marks lost.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <PrintButton />
          <Link className="tp-btn tp-btn-ghost" href="/app/analytics">Analytics</Link>
        </div>
      </div>

      <div className="tp-report-sheet">
        <header className="tp-report-head">
          <div>
            <span className="tp-pro-badge"><Icon name="crown" size={13} /> Paid plan revision sheet</span>
            <h2>{exam.name}</h2>
            <p>Wrong answers and published formulas · {formatDate(new Date(), { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div className="tp-report-head-meta">
            <span><Icon name="x" size={14} /> {sheet.mistakes.length} mistakes</span>
            <span><Icon name="target" size={14} /> {sheet.groups.length} topic{sheet.groups.length === 1 ? "" : "s"} to revisit</span>
            <span><Icon name="book" size={14} /> {sheet.formulas.length} formula topic{sheet.formulas.length === 1 ? "" : "s"}</span>
          </div>
        </header>

        {sheet.groups.length ? (
          <section className="tp-report-block">
            <h3>Where the marks went</h3>
            <div className="tp-row tp-gap-8 tp-wrap">
              {sheet.groups.map((group) => (
                <span className="tp-pill tp-pill-danger" key={group.topic}>{group.topic} · {group.count}</span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="tp-report-block">
          <h3>Mistakes</h3>
          {sheet.mistakes.length ? (
            <div className="tp-mistake-list">
              {sheet.mistakes.map((mistake, index) => (
                <article className="tp-mistake" key={mistake.id}>
                  <div className="tp-mistake-head">
                    <span className="tp-mistake-index">{index + 1}</span>
                    <div>
                      <div className="tp-mistake-tags">
                        <span className="tp-pill">{mistake.subject}</span>
                        <span className="tp-pill">{mistake.topic}</span>
                        <span className="tp-pill tp-pill-danger">−{mistake.marksLost}</span>
                      </div>
                      <p className="tp-xs tp-faint" style={{ marginTop: 6 }}>{mistake.paper} · {formatDate(mistake.date, { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                  <p className="tp-mistake-question">{mistake.question}</p>
                  <div className="tp-mistake-answers">
                    <div className="tp-mistake-answer tp-mistake-wrong">
                      <span>Your answer</span>
                      <p>{mistake.yourAnswer}</p>
                    </div>
                    <div className="tp-mistake-answer tp-mistake-right">
                      <span>Correct answer</span>
                      <p>{mistake.correctAnswer}</p>
                    </div>
                  </div>
                  {mistake.explanation ? (
                    <div className="tp-mistake-explanation">
                      <strong>Why</strong>
                      <p>{mistake.explanation}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="tp-empty" style={{ padding: "28px 16px" }}>
              <h3>No wrong answers in this window</h3>
              <p>Submit a paper to build the mistake sheet. Correct answers are never listed here.</p>
            </div>
          )}
        </section>

        <section className="tp-report-block">
          <h3>Formulas</h3>
          {sheet.formulas.length ? (
            <div className="tp-formula-groups">
              {[...bySubject.entries()].map(([subject, chapters]) => (
                <div key={subject} className="tp-formula-group">
                  <h4>{subject}</h4>
                  {chapters.map((chapter) => (
                    <div key={chapter.chapter} className="tp-formula-chapter">
                      <div className="tp-formula-chapter-title">{chapter.chapter}</div>
                      {chapter.formulas.map((formula) => (
                        <div className="tp-formula-item" key={formula.id}>
                          <strong>{formula.title}</strong>
                          <p className="tp-formula">{formulaText(formula.formulas)}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="tp-small tp-muted">No formulas have been recorded for this exam's syllabus yet.</p>
          )}
        </section>

        <footer className="tp-report-foot">
          <span>TopRank AI · revision sheet</span>
          <span>Built from submitted papers, not generated examples.</span>
        </footer>
      </div>
    </>
  );
}
