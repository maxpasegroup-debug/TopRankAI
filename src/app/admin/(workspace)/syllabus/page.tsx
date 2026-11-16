import Link from "next/link";
import { SyllabusAdmin, type AdminSyllabusUnit } from "@/components/platform/admin/SyllabusAdmin";
import { listAdminExamOptions, listAdminExamSubjectOptions, listAdminSyllabus } from "@/server/admin/platform-admin";
import { getSyllabusSourceStatus } from "@/server/platform/syllabus-sources";
import { formatDate } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Syllabus library" };

export default async function AdminSyllabusPage({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const { exam: examCode } = await searchParams;
  const exams = await listAdminExamOptions();
  const selected = exams.find((exam) => exam.code === examCode) ?? exams[0] ?? null;

  const [subjects, units, sourceStatus] = selected
    ? await Promise.all([
        listAdminExamSubjectOptions(selected.id),
        listAdminSyllabus(selected.id),
        getSyllabusSourceStatus(selected.id),
      ])
    : [[], [], null];

  const rows: AdminSyllabusUnit[] = units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    subjectId: unit.subjectId,
    chapters: unit.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      topics: chapter.topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        estimatedMinutes: topic.estimatedMinutes,
        active: topic.active,
      })),
    })),
  }));

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Content</div>
          <h1>Syllabus library</h1>
          <p>Units, chapters and topics are mapped to an exam and a subject, and appear in the candidate learning centre.</p>
        </div>
        <span className="tp-pill tp-pill-brand">{rows.reduce((sum, unit) => sum + unit.chapters.reduce((inner, chapter) => inner + chapter.topics.length, 0), 0)} topics</span>
      </div>

      {exams.length ? (
        <>
          <div className="tp-tabs tp-mb-20">
            {exams.map((exam) => (
              <Link
                key={exam.id}
                className="tp-tab"
                data-active={exam.id === selected?.id}
                href={`/admin/syllabus?exam=${encodeURIComponent(exam.code)}`}
              >
                {exam.code}
              </Link>
            ))}
          </div>
          {selected ? (
            <SyllabusAdmin examId={selected.id} examName={selected.name} subjects={subjects} units={rows} />
          ) : null}

          {sourceStatus ? (
            <section className="tp-card tp-card-pad tp-mt-24">
              <div className="tp-row-between tp-wrap tp-gap-8" style={{ alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: 17 }}>Official source imports</h2>
                  <p className="tp-small tp-muted" style={{ maxWidth: 640, marginTop: 4 }}>
                    Syllabus and information bulletins fetched from official websites. Imported excerpts are quoted to
                    the AI when it drafts questions or notes for this exam, so drafts stay anchored to a real document.
                    Nothing is invented; failed fetches are recorded with their error.
                  </p>
                </div>
                <div className="tp-row tp-gap-8 tp-wrap">
                  <span className="tp-pill tp-pill-ok">{sourceStatus.imported} imported</span>
                  <span className="tp-pill tp-pill-warn">{sourceStatus.failed} failed</span>
                  {sourceStatus.pending ? <span className="tp-pill">{sourceStatus.pending} pending</span> : null}
                </div>
              </div>

              {sourceStatus.recent.length ? (
                <div className="tp-stack tp-gap-8 tp-mt-16">
                  {sourceStatus.recent.map((source) => (
                    <div
                      key={source.id}
                      className="tp-row-between tp-gap-12 tp-wrap"
                      style={{ padding: "10px 12px", border: "1px solid var(--tp-line)", borderRadius: 12 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="tp-row tp-gap-8 tp-wrap">
                          <span className={`tp-pill ${source.status === "IMPORTED" ? "tp-pill-ok" : source.status === "FAILED" ? "tp-pill-warn" : ""}`}>
                            {source.status.toLowerCase()}
                          </span>
                          <span className="tp-pill">{source.format.toLowerCase()}</span>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{source.label}</span>
                        </div>
                        <a
                          className="tp-xs tp-faint"
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: 4, wordBreak: "break-all" }}
                        >
                          {source.url}
                        </a>
                        {source.error ? (
                          <div className="tp-xs tp-muted" style={{ marginTop: 4 }}>{source.error}</div>
                        ) : null}
                      </div>
                      <span className="tp-xs tp-faint tp-nowrap">{formatDate(source.fetchedAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tp-small tp-muted tp-mt-16">
                  No official source has been imported for this exam yet. Run the importer with the official syllabus URL:
                  <br />
                  <code className="tp-code" style={{ fontFamily: "var(--tp-mono, ui-monospace, monospace)", fontSize: 12.5, background: "var(--tp-surface-2)", padding: "2px 6px", borderRadius: 6 }}>npx tsx scripts/import-syllabus.ts --exam={selected?.code}</code>
                </p>
              )}
            </section>
          ) : null}
        </>
      ) : (
        <div className="tp-empty">
          <h3>No active exam</h3>
          <p>Create an exam first, then add its syllabus.</p>
          <Link className="tp-btn" href="/admin/exams">Open exam catalogue</Link>
        </div>
      )}
    </>
  );
}

