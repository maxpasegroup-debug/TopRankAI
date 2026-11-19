import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { requireAuth } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getActiveExam } from "@/server/platform/active";
import { getSyllabusCompletion } from "@/server/platform/candidate";
import { getSyllabusView } from "@/server/platform/insights";
import { getProSubscription } from "@/server/platform/pro";
import { ProUpsell } from "@/components/platform/app/ProUpsell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning centre" };

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAuth();
  const query = ((await searchParams).q ?? "").trim();
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
  const pro = Boolean(await getProSubscription(user.id));
  const officialSources = await prisma.syllabusSource.findMany({
    where: { examId: exam.examId, status: "IMPORTED" },
    orderBy: { fetchedAt: "desc" },
    select: { id: true, label: true, url: true },
  });
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

  const allTopics = view.subjects.flatMap((subject) =>
    subject.units.flatMap((unit) =>
      unit.chapters.flatMap((chapter) =>
        chapter.topics.map((topic) => ({ topic, subject, unit, chapter })),
      ),
    ),
  );
  const normalizedQuery = query.toLowerCase();
  const searchResults = normalizedQuery
    ? allTopics.filter(({ topic, chapter }) =>
        `${topic.title} ${topic.description ?? ""} ${chapter.title}`.toLowerCase().includes(normalizedQuery),
      )
    : [];
  const notesReady = allTopics.filter(
    ({ topic }) => (topic.content ?? "").trim().length > 200 || topic.materials.length > 0,
  ).length;
  const continueTopics = allTopics
    .filter(({ topic }) => Boolean(topic.progress[0]?.lastStudiedAt))
    .sort(
      (left, right) =>
        new Date(right.topic.progress[0]!.lastStudiedAt!).getTime() -
        new Date(left.topic.progress[0]!.lastStudiedAt!).getTime(),
    )
    .slice(0, 3);
  const savedTopics = allTopics.filter(({ topic }) => topic.progress[0]?.bookmarked).slice(0, 4);

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

      {!pro ? (
        <ProUpsell
          compact
          title="Turn study into marks"
          body="Finish a chapter, then build a custom test on it. Paid plans add custom tests, printable formula and mistake sheets and report cards."
          points={["Custom tests on any topic", "Formula and mistake sheets", "Report cards"]}
        />
      ) : null}

      <form className="tp-row tp-gap-8 tp-wrap tp-mb-20" action="/app/learn" method="get" role="search">
        <label className="tp-sr" htmlFor="topic-search">Search topics</label>
        <input
          id="topic-search"
          className="tp-input"
          name="q"
          defaultValue={query}
          placeholder="Search a topic or chapter, for example 'Entropy' or 'Mendel'"
          style={{ flex: "1 1 280px", maxWidth: 520 }}
        />
        <button className="tp-btn tp-btn-sm" type="submit"><Icon name="search" size={14} /> Search</button>
        {query ? <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/app/learn">Clear</Link> : null}
      </form>

      <div className="tp-grid tp-grid-4 tp-mb-24">
        {[
          { label: "Total topics", value: completion.total, note: "In this exam syllabus" },
          { label: "Completed", value: completion.completed, note: "Marked complete by you" },
          { label: "Notes ready", value: notesReady, note: "Curated or syllabus-grounded AI notes" },
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

      {continueTopics.length ? (
        <section className="tp-mb-28">
          <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 18 }}>Continue studying</h2>
            <span className="tp-xs tp-faint">Based on your last visit</span>
          </div>
          <div className="tp-grid tp-grid-3">
            {continueTopics.map(({ topic, subject, chapter }) => (
              <Link className="tp-card tp-card-pad" href={`/app/learn/${topic.id}`} key={topic.id} style={{ textDecoration: "none" }}>
                <div className="tp-xs tp-faint">{subject.name} · {chapter.title}</div>
                <div style={{ fontWeight: 650, margin: "6px 0" }}>{topic.title}</div>
                <span className="tp-link tp-small">Continue reading <Icon name="arrow-right" size={13} /></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {savedTopics.length ? (
        <section className="tp-mb-28">
          <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 18 }}>Saved topics</h2>
            <span className="tp-xs tp-faint">Bookmarked by you</span>
          </div>
          <div className="tp-row tp-gap-8 tp-wrap">
            {savedTopics.map(({ topic }) => (
              <Link className="tp-pill tp-pill-brand" href={`/app/learn/${topic.id}`} key={topic.id} style={{ textDecoration: "none" }}>
                <Icon name="star" size={12} /> {topic.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {query ? (
        <section className="tp-card tp-card-pad tp-mb-24">
          <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 18 }}>Results for “{query}”</h2>
            <span className="tp-pill">{searchResults.length} matching topic{searchResults.length === 1 ? "" : "s"}</span>
          </div>
          {searchResults.length ? (
            <div className="tp-stack tp-gap-8">
              {searchResults.slice(0, 80).map(({ topic, subject, chapter }) => {
                const status = topic.progress[0]?.status ?? "NOT_STARTED";
                return (
                  <Link className="tp-topic-row" href={`/app/learn/${topic.id}`} key={topic.id}>
                    <span className="tp-topic-status" data-status={status} />
                    <span className="tp-grow">
                      {topic.title}
                      <span className="tp-xs tp-faint" style={{ display: "block", marginTop: 2 }}>{subject.name} · {chapter.title}</span>
                    </span>
                    <Icon name="chevron-right" size={14} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="tp-small tp-muted" style={{ margin: 0 }}>
              No topic in this exam matches that search. Try a shorter phrase, the chapter name, or clear the search.
            </p>
          )}
        </section>
      ) : view.subjects.length ? (
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
                <details className="tp-unit" key={unit.id}>
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
                                {(topic.content ?? "").trim().length > 200 || topic.materials.length > 0 ? (
                                  <span className="tp-xs tp-faint">notes</span>
                                ) : null}
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
        <strong>Where this comes from.</strong> Each topic page quotes the matching passage from the exam
        authority&apos;s own syllabus document. The document is kept locally so the wording can be checked; the
        link below opens the original.
        {officialSources.length ? (
          <div className="tp-stack tp-gap-6" style={{ marginTop: 10 }}>
            {officialSources.map((source) => (
              <a className="tp-link" key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">
                {source.label} <Icon name="arrow-right" size={12} />
              </a>
            ))}
          </div>
        ) : (
          <span> No official document has been imported for this exam yet.</span>
        )}
      </div>
    </>
  );
}

