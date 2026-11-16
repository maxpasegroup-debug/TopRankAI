import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/platform/Icon";
import { TopicActions } from "@/components/platform/app/TopicActions";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/session";
import { getTopicView } from "@/server/platform/insights";
import { getOfficialSyllabusExcerpt } from "@/server/platform/syllabus-sources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Topic" };

const statusLabel: Record<string, string> = {
  NOT_STARTED: "Not started",
  LEARNING: "Learning",
  COMPLETED: "Completed",
  NEEDS_REVISION: "Needs revision",
};

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
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
  );

  return (
    <>
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
          </section>

          <section className="tp-card tp-card-pad">
            <h2 style={{ fontSize: 19, marginBottom: 12 }}>Study notes</h2>
            {topic.content ? (
              <div className="tp-topic-body">{topic.content}</div>
            ) : (
              <p className="tp-small tp-muted">
                Curated notes for this topic are not written yet. Use the AI notes panel to generate a starting
                summary, and cross-check it against the official syllabus.
              </p>
            )}
            {topic.formulas ? (
              <>
                <h3 style={{ fontSize: 15, margin: "20px 0 8px" }}>Formulas</h3>
                <div className="tp-formula">{topic.formulas}</div>
              </>
            ) : null}
            {topic.examples ? (
              <>
                <h3 style={{ fontSize: 15, margin: "20px 0 8px" }}>Worked examples</h3>
                <div className="tp-topic-body">{topic.examples}</div>
              </>
            ) : null}
          </section>

          {topic.materials.length ? (
            <section className="tp-card tp-card-pad">
              <h2 style={{ fontSize: 19, marginBottom: 12 }}>Materials</h2>
              <div className="tp-stack tp-gap-16">
                {topic.materials.map((material) => (
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
        </div>

        <aside className="tp-stack tp-gap-20">
          <TopicActions topicId={topic.id} status={status} bookmarked={progress?.bookmarked ?? false} />

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
