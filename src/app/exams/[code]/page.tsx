import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/platform/Icon";
import { PublicShell } from "@/components/platform/PublicShell";
import { getPublicExam } from "@/server/platform/public";
import { sectionMarkLabel } from "@/server/platform/patterns";
import { formatDate } from "@/server/platform/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await getPublicExam(code);
  return data ? { title: data.exam.name, description: data.exam.description ?? undefined } : { title: "Exam not found" };
}

export default async function ExamDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await getPublicExam(code);
  if (!data) notFound();
  const { exam, subjects, dates, topicCount } = data;
  const primaryPart = exam.parts[0] ?? null;

  return (
    <PublicShell>
      <section className="tp-exam-section">
        <div className="tp-shell">
          <div className="tp-row tp-gap-8 tp-small tp-muted" style={{ marginBottom: 20 }}>
            <Link href="/exams" className="tp-link">Exams</Link>
            <Icon name="chevron-right" size={14} />
            <span>{exam.category}</span>
          </div>

          <div className="tp-dash tp-exam-overview">
            <div>
              <span className="tp-pill tp-pill-brand">{exam.category}</span>
              <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)", letterSpacing: "-0.035em", margin: "16px 0 12px" }}>{exam.name}</h1>
              <p className="tp-lede" style={{ maxWidth: 640 }}>{exam.description}</p>
              <div className="tp-row tp-gap-8 tp-wrap tp-mt-24">
                {exam.subjectNames.map((subject) => <span className="tp-pill" key={subject}>{subject}</span>)}
              </div>
              <div className="tp-hero-actions">
                <Link className="tp-btn tp-btn-lg" href="/register">Prepare for {exam.shortName ?? exam.name}</Link>
                <Link className="tp-btn tp-btn-ghost tp-btn-lg" href="/how-it-works">How the daily loop works</Link>
              </div>
            </div>

            <aside className="tp-card tp-card-pad">
              <h3 style={{ fontSize: 17, marginBottom: 16 }}>Paper snapshot</h3>
              <div className="tp-stack tp-gap-12">
                {[
                  ["Duration", `${primaryPart?.durationMinutes ?? exam.durationMinutes} minutes`],
                  ["Total questions", `${primaryPart?.totalQuestions ?? exam.totalQuestions}`],
                  ["Total marks", primaryPart ? `${primaryPart.totalMarks}` : `+${exam.positiveMarks} per correct`],
                  ["Daily papers", "1–8 · start time per exam"],
                  ["Marking", `+${exam.positiveMarks} / −${exam.negativeMarks}`],
                  ["Paper variants", `${exam.parts.length || 1}`],
                  ["Syllabus topics", topicCount.toLocaleString("en-IN")],
                  ["Reviewed questions", `${exam.questionCount}`],
                ].map(([label, value]) => (
                  <div className="tp-snapshot-row tp-small" key={label}>
                    <span className="tp-muted">{label}</span>
                    <span style={{ fontWeight: 650 }}>{value}</span>
                  </div>
                ))}
              </div>
              {exam.officialUrl ? (
                <>
                  <div className="tp-divider" style={{ margin: "18px 0" }} />
                  <a className="tp-btn tp-btn-soft tp-btn-block" href={exam.officialUrl} target="_blank" rel="noopener noreferrer">
                    Official website <Icon name="arrow-right" size={15} />
                  </a>
                </>
              ) : null}
            </aside>
          </div>

          {exam.markingNote ? (
            <div className="tp-note tp-mt-32" style={{ maxWidth: 900 }}>
              <strong>Marking model.</strong> {exam.markingNote}
            </div>
          ) : null}
        </div>
      </section>

      {exam.parts.length ? (
        <section className="tp-exam-section">
          <div className="tp-shell">
            <span className="tp-eyebrow">Paper pattern</span>
            <h2 style={{ fontSize: 28, margin: "12px 0 18px", letterSpacing: "-0.03em" }}>Choose the paper that matches your goal</h2>
            <div className="tp-paper-variants">
              {exam.parts.map((part) => (
                <article className="tp-card tp-card-pad" key={part.code}>
                  <div className="tp-row-between tp-wrap tp-gap-8">
                    <h3 style={{ fontSize: 17 }}>{part.name}</h3>
                    <span className={`tp-pill ${part.verified ? "tp-pill-ok" : "tp-pill-warn"}`}>
                      {part.verified ? "Verified pattern" : "Needs verification"}
                    </span>
                  </div>
                  <p className="tp-xs tp-faint" style={{ marginTop: 4 }}>
                    {part.totalQuestions} questions · {part.totalMarks} marks · {part.durationMinutes} minutes
                  </p>
                  {part.description ? <p className="tp-small tp-muted" style={{ marginTop: 8 }}>{part.description}</p> : null}
                  <div className="tp-stack tp-gap-6 tp-mt-12">
                    {part.sections.map((section) => (
                      <div className="tp-snapshot-row tp-xs" key={section.name}>
                        <span className="tp-muted">{section.name}</span>
                        <span style={{ fontWeight: 600 }}>
                          {section.questionCount} Q · {sectionMarkLabel(section)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {part.sourceUrl ? (
                    <a className="tp-link tp-xs" href={part.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12 }}>
                      Official source
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
            {exam.patternNote ? <div className="tp-note tp-mt-16">{exam.patternNote}</div> : null}
          </div>
        </section>
      ) : null}

      <section className="tp-exam-section">
        <div className="tp-shell">
          <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
            <div>
              <span className="tp-eyebrow">Syllabus</span>
              <h2 style={{ fontSize: 28, margin: "12px 0 18px", letterSpacing: "-0.03em" }}>What this paper covers</h2>
              {subjects.length ? subjects.map((subject) => (
                <details className="tp-unit" key={subject.name}>
                  <summary className="tp-unit-head">
                    <Icon name="chevron-right" className="tp-unit-chevron" />
                    <h3>{subject.name}</h3>
                    <span className="tp-pill">{subject.units.length} units</span>
                  </summary>
                  <div className="tp-unit-body">
                    {subject.units.map((unit) => (
                      <div className="tp-chapter" key={unit.title}>
                        <h4>{unit.title}</h4>
                        <div className="tp-small tp-muted">{unit.chapters} chapters · {unit.topics} topics</div>
                      </div>
                    ))}
                  </div>
                </details>
              )) : (
                <div className="tp-empty">
                  <h3>Syllabus is being mapped</h3>
                  <p>Topics for this exam have not been published yet. The daily paper uses the existing reviewed question bank.</p>
                </div>
              )}
            </div>

            <div>
              <span className="tp-eyebrow">Dates</span>
              <h2 style={{ fontSize: 28, margin: "12px 0 18px", letterSpacing: "-0.03em" }}>Official calendar</h2>
              {dates.length ? (
                <div className="tp-card">
                  {dates.map((event) => (
                    <div className="tp-list-item" style={{ padding: "16px 20px" }} key={event.id}>
                      <div className="tp-activity-badge"><Icon name="calendar" size={17} /></div>
                      <div className="tp-grow">
                        <div className="tp-activity-title">{event.title}</div>
                        <div className="tp-activity-meta">
                          {formatDate(event.startDate)}{event.endDate ? ` – ${formatDate(event.endDate)}` : ""} · {event.eventType.replace(/_/g, " ").toLowerCase()}
                        </div>
                      </div>
                      <span className={`tp-pill ${event.status === "CONFIRMED" ? "tp-pill-ok" : "tp-pill-warn"}`}>{event.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tp-card tp-card-pad tp-stack tp-gap-12 tp-calendar-summary">
                  <h3>Awaiting verified dates</h3>
                  <p className="tp-small tp-muted">Candidates preparing for {exam.shortName ?? exam.name} receive a workspace notification when a date is confirmed.</p>
                  {exam.officialUrl ? (
                    <a className="tp-btn tp-btn-soft" href={exam.officialUrl} target="_blank" rel="noopener noreferrer">Check official website</a>
                  ) : null}
                </div>
              )}

            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
