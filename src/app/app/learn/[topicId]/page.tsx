import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/platform/Icon";
import { StudyNotes } from "@/components/platform/StudyNotes";
import { TopicActions } from "@/components/platform/app/TopicActions";
import { TopicVisitTracker } from "@/components/platform/app/TopicVisitTracker";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/session";
import { getTopicView } from "@/server/platform/insights";
import { getOfficialSyllabusExcerpt, getSyllabusDocuments } from "@/server/platform/syllabus-sources";
import { getOfficialStudyResources } from "@/server/platform/study-resources";
import { formulaText } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Topic" };

const statusLabel: Record<string, string> = {
  NOT_STARTED: "Not started",
  LEARNING: "Learning",
  COMPLETED: "Completed",
  NEEDS_REVISION: "Needs revision",
};

export default async function TopicPage({ params, searchParams }: { params: Promise<{ topicId: string }>; searchParams: Promise<{ source?: string }> }) {
  const { topicId } = await params;
  const user = await requireAuth();
  const view = await getTopicView(user.id, topicId);
  if (!view) notFound();

  const target = await prisma.candidateExamTarget.findFirst({
    where: { userId: user.id, examId: view.topic.chapter.unit.examId, active: true },
    select: { id: true },
  });
  if (!target) notFound();

  const { topic, progress, exam } = view;
  const status = (progress?.status ?? "NOT_STARTED") as "NOT_STARTED" | "LEARNING" | "COMPLETED" | "NEEDS_REVISION";
  const official = await getOfficialSyllabusExcerpt(
    topic.chapter.unit.examId,
    topic.chapter.unit.subject.id,
    topic.title,
    topic.description,
    topic.chapter.title, topic.chapter.unit.subject.name, exam?.code,
  );
  const documents = await getSyllabusDocuments(topic.chapter.unit.examId, topic.chapter.unit.subject.id, exam?.code ?? "");
  const selectedUrl = (await searchParams).source;
  const selectedDocument = documents.find((source) => source.url === selectedUrl);
  if (selectedDocument) return (
    <section className="tp-card tp-card-pad tp-stack tp-gap-16">
      <Link className="tp-link" href={`/app/learn/${topic.id}`}>← Back to {topic.title}</Link>
      <h1>{selectedDocument.label}</h1>
      <a className="tp-link" href={selectedDocument.url} target="_blank" rel="noopener noreferrer">Open original document</a>
      <div className="tp-topic-body">{selectedDocument.content}</div>
    </section>
  );
  const resources = getOfficialStudyResources(topic.chapter.unit.subject.code);
  const aiNotes = topic.materials.filter(
    (material) => material.type === "NOTES" && /^AI[-\s]/i.test(material.title),
  );
  const otherMaterials = topic.materials.filter(
    (material) => !aiNotes.some((note) => note.id === material.id),
  );
  const [previousTopic, nextTopic] = await Promise.all([
    prisma.syllabusTopic.findFirst({
      where: { chapterId: topic.chapterId, order: { lt: topic.order }, active: true },
      orderBy: { order: "desc" },
      select: { id: true, title: true },
    }),
    prisma.syllabusTopic.findFirst({
      where: { chapterId: topic.chapterId, order: { gt: topic.order }, active: true },
      orderBy: { order: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <TopicVisitTracker topicId={topic.id} />
      <div className="tp-row tp-gap-8 tp-small tp-muted tp-wrap" style={{ marginBottom: 16 }}>
        <Link className="tp-link" href="/app/learn">Learning centre</Link>
        <Icon name="chevron-right" size={14} />
        <span>{topic.chapter.unit.subject.name}</span>
        <Icon name="chevron-right" size={14} />
        <span>{topic.chapter.unit.title}</span>
        <Icon name="chevron-right" size={14} />
        <span>{topic.chapter.title}</span>
      </div>

      <div className="tp-page-head">
        <div>
          <div className="tp-row tp-gap-8 tp-wrap" style={{ marginBottom: 8 }}>
            <span className="tp-pill tp-pill-brand">{topic.chapter.unit.subject.name}</span>
            <span className={`tp-pill ${status === "COMPLETED" ? "tp-pill-ok" : status === "NEEDS_REVISION" ? "tp-pill-warn" : ""}`}>{statusLabel[status]}</span>
            <span className="tp-pill tp-capitalize">{topic.difficulty.toLowerCase()}</span>
            <span className="tp-pill"><Icon name="clock" size={13} /> {topic.estimatedMinutes} min</span>
          </div>
          <h1>{topic.title}</h1>
          {topic.description ? <p>{topic.description}</p> : null}
        </div>
        {exam ? (
          <div className="tp-row tp-gap-8 tp-wrap">
            <span className="tp-pill">{exam.name}</span>
            {exam.officialUrl ? (
              <a className="tp-btn tp-btn-ghost tp-btn-sm" href={exam.officialUrl} target="_blank" rel="noopener noreferrer">
                Official syllabus <Icon name="arrow-right" size={13} />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="tp-dash">
        <div className="tp-stack tp-gap-20">
          <section className="tp-card tp-card-pad">
            <div className="tp-row-between tp-wrap tp-gap-8" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 19 }}>In the official syllabus</h2>
              {official ? <span className="tp-pill tp-pill-brand"><Icon name="book" size={13} /> Official document</span> : null}
            </div>
            {official ? (
              <>
                <div className="tp-topic-body" style={{ fontSize: 14 }}>
                  {official.text}
                </div>
                <div className="tp-stack tp-gap-6" style={{ marginTop: 14 }}>
                  <div className="tp-xs tp-faint">Quoted from:</div>
                  {official.sources.map((source) => (
                    <a
                      className="tp-link tp-small"
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.label} <Icon name="arrow-right" size={12} />
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <p className="tp-small tp-muted" style={{ margin: 0 }}>
                The official document for this exam does not contain a passage that matches this topic closely
                enough to quote, so the notes below are curated rather than copied. Check the syllabus document
                itself before relying on a topic boundary.
              </p>
            )}
            {documents.length > 0 && <div className="tp-stack tp-gap-8 tp-mt-16">
              {documents.map((source) => <div key={source.url} className="tp-stack tp-gap-6">
                {source.note && <p className="tp-small tp-muted">{source.note}</p>}
                {source.syllabusUrl && <a className="tp-link" href={source.syllabusUrl} target="_blank" rel="noopener noreferrer">Official subject-wise syllabuses</a>}
                <Link className="tp-link tp-small" prefetch={false}
                href={`/app/learn/${topic.id}?source=${encodeURIComponent(source.url)}`}>
                Read complete document · {source.label}
                </Link>
              </div>)}
            </div>}
          </section>

          <section className="tp-card tp-card-pad">
            <div className="tp-row-between tp-wrap tp-gap-8" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 19 }}>Study notes</h2>
              {aiNotes.length ? <span className="tp-pill tp-pill-brand"><Icon name="spark" size={13} /> AI-generated</span> : null}
            </div>
            {topic.content ? <StudyNotes content={topic.content} /> : null}
            {aiNotes.map((material) => (
              <div key={material.id} style={{ marginTop: topic.content ? 24 : 0 }}>
                <div className="tp-row-between tp-gap-8 tp-wrap" style={{ marginBottom: 8 }}>
                  <h3 style={{ fontSize: 15 }}>{
                    (() => {
                      const label = material.title.replace(/^AI-generated\s*/i, "").trim() || "Detailed notes";
                      return label.charAt(0).toUpperCase() + label.slice(1);
                    })()
                  }</h3>
                  <span className="tp-xs tp-faint">Written from the official syllabus · review critically</span>
                </div>
                {material.content ? <StudyNotes content={material.content} /> : null}
              </div>
            ))}
            {!topic.content && !aiNotes.length ? (
              <div className="tp-stack tp-gap-10">
                <p className="tp-small tp-muted" style={{ margin: 0 }}>
                  Detailed notes for this topic have not been added yet. Use the official syllabus passage above and
                  the official resources below, or generate AI notes from the panel. AI notes are labelled and are
                  not an official publication.
                </p>
                <div className="tp-note">
                  <strong>Start here.</strong>
                  <ol className="tp-notes-list" style={{ marginTop: 8 }}>
                    <li>Read the official syllabus boundary above so you know what is examinable.</li>
                    <li>Open the matching NCERT / DIKSHA / NPTEL resource and read that section.</li>
                    <li>Attempt the {topic._count.questions} related question{topic._count.questions === 1 ? "" : "s"} in this topic and review every mistake.</li>
                  </ol>
                </div>
              </div>
            ) : null}
            {topic.formulas ? (
              <>
                <h3 style={{ fontSize: 15, margin: "22px 0 8px" }}>Formulas</h3>
                <div className="tp-formula">{formulaText(topic.formulas)}</div>
              </>
            ) : null}
            {topic.examples ? (
              <>
                <h3 style={{ fontSize: 15, margin: "22px 0 8px" }}>Worked examples</h3>
                <StudyNotes content={topic.examples} />
              </>
            ) : null}
          </section>

          {resources.length ? (
            <section className="tp-card tp-card-pad">
              <div className="tp-row-between tp-wrap tp-gap-8" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 19 }}>Official study resources</h2>
                <span className="tp-pill">External · opens on publisher site</span>
              </div>
              <div className="tp-stack tp-gap-12">
                {resources.map((resource) => (
                  <div className="tp-chapter" key={resource.url} style={{ borderTop: 0, padding: 0 }}>
                    <div className="tp-row-between tp-gap-8 tp-wrap" style={{ marginBottom: 4 }}>
                      <a className="tp-link" href={resource.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 650 }}>
                        {resource.title} <Icon name="arrow-right" size={13} />
                      </a>
                      <span className="tp-pill">{resource.kind}</span>
                    </div>
                    <div className="tp-xs tp-muted">{resource.publisher}</div>
                    <div className="tp-xs tp-faint" style={{ marginTop: 3, lineHeight: 1.5 }}>{resource.note}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {otherMaterials.length ? (
            <section className="tp-card tp-card-pad">
              <h2 style={{ fontSize: 19, marginBottom: 12 }}>More materials</h2>
              <div className="tp-stack tp-gap-16">
                {otherMaterials.map((material) => (
                  <div className="tp-chapter" key={material.id} style={{ borderTop: 0, padding: 0 }}>
                    <div className="tp-row-between" style={{ marginBottom: 6 }}>
                      <div className="tp-row tp-gap-8">
                        <Icon name={material.type === "NOTES" ? "book" : "layers"} size={16} />
                        <h3 style={{ fontSize: 15 }}>{material.title}</h3>
                      </div>
                      <span className="tp-pill">{material.type.replace(/_/g, " ").toLowerCase()}</span>
                    </div>
                    {material.content ? <div className="tp-topic-body" style={{ fontSize: 14 }}>{material.content}</div> : null}
                    {material.url ? (
                      <a className="tp-link tp-small" href={material.url} target="_blank" rel="noopener noreferrer">
                        Open resource
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="tp-note">
            <strong>Study honestly.</strong> Reading is not the same as practising. After this topic, attempt the daily
            paper or mark it as needing revision so it returns in your revision queue.
          </div>

          <nav className="tp-row-between tp-gap-12 tp-wrap" aria-label="Topic navigation">
            {previousTopic ? (
              <Link className="tp-btn tp-btn-ghost tp-btn-sm" href={`/app/learn/${previousTopic.id}`}>
                <Icon name="arrow-left" size={14} /> {previousTopic.title}
              </Link>
            ) : (
              <span />
            )}
            {nextTopic ? (
              <Link className="tp-btn tp-btn-soft tp-btn-sm" href={`/app/learn/${nextTopic.id}`}>
                {nextTopic.title} <Icon name="arrow-right" size={14} />
              </Link>
            ) : null}
          </nav>
        </div>

        <aside className="tp-stack tp-gap-20">
          <TopicActions topicId={topic.id} status={status} bookmarked={progress?.bookmarked ?? false} hasAiNotes={aiNotes.length > 0} />

          <section className="tp-card tp-card-pad">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Topic facts</h3>
            <div className="tp-stack tp-gap-10">
              {[
                ["Unit", topic.chapter.unit.title],
                ["Chapter", topic.chapter.title],
                ["Subject", topic.chapter.unit.subject.name],
                ["Related questions", `${topic._count.questions}`],
                ["Last studied", progress?.lastStudiedAt ? new Date(progress.lastStudiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not yet"],
              ].map(([label, value]) => (
                <div className="tp-row-between tp-small" key={label}>
                  <span className="tp-muted">{label}</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <Link className="tp-btn tp-btn-ghost tp-btn-block" href="/app/learn">
            <Icon name="arrow-left" size={15} /> Back to syllabus
          </Link>
        </aside>
      </div>
    </>
  );
}
