"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { addSyllabusAction, importSyllabusAction } from "@/server/actions/admin";

export type AdminSyllabusSubject = { id: string; name: string };
export type AdminSyllabusTopic = { id: string; title: string; description: string | null; estimatedMinutes: number; active: boolean };
export type AdminSyllabusChapter = { id: string; title: string; topics: AdminSyllabusTopic[] };
export type AdminSyllabusUnit = { id: string; title: string; subjectId: string; chapters: AdminSyllabusChapter[] };

export function SyllabusAdmin({
  examId,
  examName,
  subjects,
  units,
}: {
  examId: string;
  examName: string;
  subjects: AdminSyllabusSubject[];
  units: AdminSyllabusUnit[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [form, setForm] = useState({
    subjectId: subjects[0]?.id ?? "",
    unitTitle: "",
    unitDescription: "",
    chapterTitle: "",
    chapterDescription: "",
    topicTitle: "",
    topicDescription: "",
    content: "",
  });

  const topicCount = units.reduce((sum, unit) => sum + unit.chapters.reduce((inner, chapter) => inner + chapter.topics.length, 0), 0);
  const subjectName = new Map(subjects.map((subject) => [subject.id, subject.name]));

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await addSyllabusAction({
        examId,
        subjectId: form.subjectId,
        unitTitle: form.unitTitle,
        unitDescription: form.unitDescription || undefined,
        chapterTitle: form.chapterTitle,
        chapterDescription: form.chapterDescription || undefined,
        topicTitle: form.topicTitle,
        topicDescription: form.topicDescription || undefined,
        content: form.content || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setForm((current) => ({ ...current, unitTitle: "", unitDescription: "", chapterTitle: "", chapterDescription: "", topicTitle: "", topicDescription: "", content: "" }));
      router.refresh();
    });
  }

  function runImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportMessage(null);
    setImportError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(importText);
    } catch {
      setImportError("The payload is not valid JSON.");
      return;
    }
    startTransition(async () => {
      const result = await importSyllabusAction({ ...(payload as Record<string, unknown>), examId });
      if (!result.ok) {
        setImportError(result.message);
        return;
      }
      setImportMessage(result.message);
      setImportText("");
      router.refresh();
    });
  }

  return (
    <div className="tp-stack tp-gap-20">
      {message ? <div className="tp-success" role="status">{message}</div> : null}
      {error ? <div className="tp-error" role="alert">{error}</div> : null}

      <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Add a syllabus topic</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>
            Existing units and chapters are reused by name, so adding a second topic to the same chapter is safe.
          </p>
          {subjects.length ? (
            <form onSubmit={submit}>
              <div className="tp-form-grid">
                <div className="tp-field tp-span-2">
                  <label className="tp-label" htmlFor="syl-subject">Subject <span>*</span></label>
                  <select id="syl-subject" className="tp-select" value={form.subjectId} onChange={(event) => update("subjectId", event.target.value)} required>
                    {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </div>
                <div className="tp-field">
                  <label className="tp-label" htmlFor="syl-unit">Unit <span>*</span></label>
                  <input id="syl-unit" className="tp-input" value={form.unitTitle} onChange={(event) => update("unitTitle", event.target.value)} required />
                </div>
                <div className="tp-field">
                  <label className="tp-label" htmlFor="syl-unit-desc">Unit description</label>
                  <input id="syl-unit-desc" className="tp-input" value={form.unitDescription} onChange={(event) => update("unitDescription", event.target.value)} />
                </div>
                <div className="tp-field">
                  <label className="tp-label" htmlFor="syl-chapter">Chapter <span>*</span></label>
                  <input id="syl-chapter" className="tp-input" value={form.chapterTitle} onChange={(event) => update("chapterTitle", event.target.value)} required />
                </div>
                <div className="tp-field">
                  <label className="tp-label" htmlFor="syl-chapter-desc">Chapter description</label>
                  <input id="syl-chapter-desc" className="tp-input" value={form.chapterDescription} onChange={(event) => update("chapterDescription", event.target.value)} />
                </div>
                <div className="tp-field tp-span-2">
                  <label className="tp-label" htmlFor="syl-topic">Topic <span>*</span></label>
                  <input id="syl-topic" className="tp-input" value={form.topicTitle} onChange={(event) => update("topicTitle", event.target.value)} required />
                </div>
                <div className="tp-field tp-span-2">
                  <label className="tp-label" htmlFor="syl-topic-desc">Topic description</label>
                  <input id="syl-topic-desc" className="tp-input" value={form.topicDescription} onChange={(event) => update("topicDescription", event.target.value)} />
                </div>
                <div className="tp-field tp-span-2">
                  <label className="tp-label" htmlFor="syl-content">Study notes (optional)</label>
                  <textarea id="syl-content" className="tp-input" rows={4} value={form.content} onChange={(event) => update("content", event.target.value)} />
                </div>
              </div>
              <button type="submit" className="tp-btn tp-mt-16" disabled={pending}>
                {pending ? "Saving…" : "Save topic"} {pending ? null : <Icon name="plus" size={15} />}
              </button>
            </form>
          ) : (
            <div className="tp-empty" style={{ padding: "26px 10px" }}>
              <h3>No subject mapped to {examName}</h3>
              <p>Add subjects to the exam from the exam catalogue before publishing its syllabus.</p>
            </div>
          )}
        </section>

        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Coverage</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>{examName}</p>
          <div className="tp-admin-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="tp-admin-stat">
              <span>Units</span>
              <strong>{units.length}</strong>
              <span>Published in this exam</span>
            </div>
            <div className="tp-admin-stat">
              <span>Topics</span>
              <strong>{topicCount}</strong>
              <span>Available to candidates</span>
            </div>
          </div>
          <div className="tp-note tp-mt-16">
            <strong>Source of truth.</strong> Syllabus content is curated from official published syllabi. There is no
            single free official API covering every Indian exam, so changes are recorded here by an administrator.
          </div>
          <div className="tp-row tp-gap-8 tp-wrap tp-mt-16">
            {[...subjectName.entries()].map(([id, name]) => {
              const count = units.filter((unit) => unit.subjectId === id).reduce((sum, unit) => sum + unit.chapters.reduce((inner, chapter) => inner + chapter.topics.length, 0), 0);
              return <span className="tp-pill" key={id}>{name} · {count}</span>;
            })}
          </div>
        </section>
      </div>

      <details className="tp-card">
        <summary className="tp-row-between" style={{ padding: "14px 18px", cursor: "pointer", listStyle: "none" }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Import verified syllabus data</h2>
            <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>Paste a JSON bundle produced from an official syllabus. Re-running is safe: records are matched by slug.</div>
          </div>
          <Icon name="upload" size={18} />
        </summary>
        <div style={{ borderTop: "1px solid var(--tp-line)", padding: "16px 18px" }}>
          <form onSubmit={runImport}>
            <div className="tp-field">
              <label className="tp-label" htmlFor="syllabus-import">JSON payload</label>
              <textarea
                id="syllabus-import"
                className="tp-input"
                rows={9}
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={'{"subjects":[{"subjectCode":"PHYSICS","units":[{"title":"Mechanics","chapters":[{"title":"Units","topics":[{"title":"SI units"}]}]}]}]}'}
                spellCheck={false}
              />
              <span className="tp-hint">
                Required shape: <code>subjects[].subjectCode</code> → <code>units[]</code> → <code>chapters[]</code> →
                <code>topics[].title</code>. Optional topic fields: description, content, estimatedMinutes.
              </span>
            </div>
            <button type="submit" className="tp-btn tp-btn-soft tp-btn-sm tp-mt-12" disabled={pending || !importText.trim()}>
              {pending ? "Importing…" : "Import syllabus"} {pending ? null : <Icon name="upload" size={14} />}
            </button>
            {importMessage ? <div className="tp-success tp-mt-12" role="status">{importMessage}</div> : null}
            {importError ? <div className="tp-error tp-mt-12" role="alert">{importError}</div> : null}
          </form>
          <div className="tp-note tp-mt-12">
            <strong>Why an import path?</strong> No free, reliable official API publishes every Indian exam
            syllabus. This endpoint is the adapter boundary: a future provider can call the same validated importer,
            while administrators can paste verified data today.
          </div>
        </div>
      </details>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Published syllabus</h2>
        {units.length ? (
          <div className="tp-stack tp-gap-12">
            {units.map((unit) => (
              <details className="tp-card" key={unit.id}>
                <summary className="tp-row-between" style={{ padding: "14px 18px", cursor: "pointer", listStyle: "none" }}>
                  <div>
                    <h3 style={{ fontSize: 15 }}>{unit.title}</h3>
                    <div className="tp-xs tp-faint" style={{ marginTop: 3 }}>{subjectName.get(unit.subjectId) ?? "Subject"} · {unit.chapters.length} chapters</div>
                  </div>
                  <span className="tp-pill">{unit.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0)} topics</span>
                </summary>
                <div style={{ borderTop: "1px solid var(--tp-line)", padding: "12px 18px 16px" }}>
                  {unit.chapters.map((chapter) => (
                    <div key={chapter.id} style={{ marginBottom: 12 }}>
                      <div className="tp-row-between" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 650 }}>{chapter.title}</span>
                        <span className="tp-xs tp-faint">{chapter.topics.length} topics</span>
                      </div>
                      <div className="tp-stack tp-gap-4">
                        {chapter.topics.map((topic) => (
                          <div className="tp-row-between tp-small" key={topic.id} style={{ padding: "5px 0", borderBottom: "1px solid var(--tp-line)" }}>
                            <span>{topic.title}</span>
                            <span className="tp-xs tp-faint">{topic.estimatedMinutes} min</span>
                          </div>
                        ))}
                        {!chapter.topics.length ? <span className="tp-xs tp-faint">No topics yet.</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="tp-empty">
            <h3>No syllabus published for this exam</h3>
            <p>Use the form above to add the first unit, chapter and topic.</p>
          </div>
        )}
      </section>
    </div>
  );
}
