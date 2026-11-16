import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { getActiveExam } from "@/server/platform/active";
import { getSyllabusCompletion } from "@/server/platform/candidate";
import { getSyllabusView } from "@/server/platform/insights";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning centre" };

export default async function LearnPage() {
  const user = await requireAuth();
  const exam = await getActiveExam(user.id);

  if (!exam) {
    return (
      <>
        <div className="tp-page-head">
          <div>
            <div className="tp-eyebrow">Learning centre</div>
            <h1>Choose an exam to open its syllabus</h1>
          </div>
        </div>
        <div className="tp-empty">
          <h3>No exam selected</h3>
          <p>Syllabus units are mapped to the exams in your plan.</p>
          <Link className="tp-btn" href="/app/exams">Choose exams</Link>
        </div>
      </>
    );
  }

  const [view, completion] = await Promise.all([getSyllabusView(user.id, exam), getSyllabusCompletion(user.id, exam.examId)]);
  const statusCounts = view.subjects.reduce(
    (acc, subject) => {
      for (const unit of subject.units) {
        for (const chapter of unit.chapters) {
          for (const topic of chapter.topics) {
            const status = topic.progress[0]?.status ?? "NOT_STARTED";
            acc[status] = (acc[status] ?? 0) + 1;
          }
        }
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">{exam.category ?? "Syllabus"} · {exam.shortName ?? exam.name}</div>
          <h1>Learning centre</h1>
          <p>Every unit, chapter and topic mapped to your exam. Mark topics as you study them.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill tp-pill-brand"><Icon name="book" size={14} /> {completion.percent}% complete</span>
          <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/planner">Planner</Link>
        </div>
      </div>

      <div className="tp-grid tp-grid-4 tp-mb-24">
        {[
          { label: "Total topics", value: completion.total, note: "In this exam syllabus" },
          { label: "Completed", value: completion.completed, note: "Marked complete by you" },
          { label: "In progress", value: statusCounts.LEARNING ?? 0, note: "Learning status" },
          { label: "Needs revision", value: statusCounts.NEEDS_REVISION ?? 0, note: "Flagged by you" },
        ].map((card) => (
          <div className="tp-stat" key={card.label}>
            <div className="tp-stat-label">{card.label}</div>
            <div className="tp-stat-value">{card.value}</div>
            <div className="tp-stat-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="tp-meter tp-mb-24"><span style={{ width: `${completion.percent}%` }} /></div>

      {view.subjects.length ? (
        <div className="tp-stack tp-gap-28">
          {view.subjects.map((subject) => (
            <section className="tp-subject-block" key={subject.id}>
              <div className="tp-row-between" style={{ marginBottom: 12 }}>
                <div className="tp-row tp-gap-8">
                  <span className="tp-feature-icon" style={{ width: 38, height: 38, margin: 0, borderRadius: 11, fontSize: 15 }}>
                    <Icon name="book" size={18} />
                  </span>
                  <div>
                    <h2 style={{ fontSize: 20 }}>{subject.name}</h2>
                    <div className="tp-xs tp-faint">{subject.completed} of {subject.topicCount} topics complete</div>
                  </div>
                </div>
                <span className="tp-pill">{subject.percent}%</span>
              </div>

              {subject.units.map((unit) => (
                <details className="tp-unit" key={unit.id} open={unit === subject.units[0]}>
                  <summary className="tp-unit-head">
                    <Icon name="chevron-right" className="tp-unit-chevron" />
                    <h3>{unit.title}</h3>
                    <span className="tp-pill">{unit.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0)} topics</span>
                  </summary>
                  <div className="tp-unit-body">
                    {unit.chapters.map((chapter) => (
                      <div className="tp-chapter" key={chapter.id}>
                        <h4>{chapter.title}</h4>
                        {chapter.topics.length ? (
                          chapter.topics.map((topic) => {
                            const status = topic.progress[0]?.status ?? "NOT_STARTED";
                            return (
                              <Link className="tp-topic-row" href={`/app/learn/${topic.id}`} key={topic.id}>
                                <span className="tp-topic-status" data-status={status} />
                                <span className="tp-grow">{topic.title}</span>
                                <span className="tp-xs tp-faint">{topic.estimatedMinutes}m</span>
                                <Icon name="chevron-right" size={14} />
                              </Link>
                            );
                          })
                        ) : (
                          <p className="tp-xs tp-faint">No topics published for this chapter yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}

              <div className="tp-meter tp-mt-16"><span style={{ width: `${subject.percent}%` }} /></div>
            </section>
          ))}
        </div>
      ) : (
        <div className="tp-empty">
          <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="book" /></span>
          <h3>The syllabus for this exam is being mapped</h3>
          <p>
            Units and topics are added as the official syllabus is verified. The daily paper still draws from the
            reviewed question bank in the meantime.
          </p>
          <Link className="tp-btn tp-btn-soft" href="/app/daily">Go to daily exams</Link>
        </div>
      )}

      <div className="tp-note tp-mt-32">
        <strong>Where this comes from.</strong> The syllabus library is curated from publicly published official
        syllabi. There is no single free official API for every Indian exam, so an administrator maintains this
        data and links the official website on each exam page.
      </div>
    </>
  );
}
