"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { useToastFeedback } from "../useToastFeedback";
import { createCategoryAction, createExamAction, generateExamPatternAction, updateExamAction } from "@/server/actions/admin";

export type AdminSubject = { id: string; name: string };
export type AdminCategory = { id: string; name: string; slug: string };

export type AdminExamRow = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string | null;
  description: string | null;
  officialUrl: string | null;
  active: boolean;
  durationMinutes: number;
  totalQuestions: number;
  dailyTestQuestions: number;
  dailyTestMinutes: number;
  positiveMarks: number;
  negativeMarks: number;
  markingNote: string | null;
  subjectCount: number;
  questionCount: number;
  candidateCount: number;
  dailyCount: number;
  subjects: string[];
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ExamAdmin({
  exams,
  subjects,
  categories,
}: {
  exams: AdminExamRow[];
  subjects: AdminSubject[];
  categories: AdminCategory[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useToastFeedback(message, setMessage, error, setError);

  const [examForm, setExamForm] = useState({
    code: "",
    name: "",
    shortName: "",
    categoryId: categories[0]?.id ?? "",
    description: "",
    officialUrl: "",
    durationMinutes: 60,
    totalQuestions: 30,
    dailyTestQuestions: 8,
    dailyTestMinutes: 12,
    positiveMarks: 4,
    negativeMarks: 1,
    markingNote: "",
  });
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", description: "", order: 100 });

  function updateExam<K extends keyof typeof examForm>(key: K, value: (typeof examForm)[K]) {
    setExamForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSubject(id: string) {
    setSubjectIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!subjectIds.length) {
      setError("Select at least one subject for the exam.");
      return;
    }
    startTransition(async () => {
      const result = await createExamAction({ ...examForm, shortName: examForm.shortName || undefined, description: examForm.description || undefined, officialUrl: examForm.officialUrl || undefined, markingNote: examForm.markingNote || undefined, subjectIds });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setExamForm((current) => ({ ...current, code: "", name: "", shortName: "", description: "" }));
      setSubjectIds([]);
      router.refresh();
    });
  }

  function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await createCategoryAction({ ...categoryForm, description: categoryForm.description || undefined });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setCategoryForm({ name: "", slug: "", description: "", order: 100 });
      router.refresh();
    });
  }

  return (
    <div className="tp-stack tp-gap-20">
      <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Add an exam shell</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>
            AI generates the official pattern and question drafts; this form creates the shell the AI works from.
            Review everything before publishing.
          </p>
          <form onSubmit={createExam}>
            <div className="tp-form-grid">
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-code">Code <span>*</span></label>
                <input id="exam-code" className="tp-input" value={examForm.code} onChange={(event) => updateExam("code", event.target.value.toUpperCase())} placeholder="SSC_CGL" required minLength={2} maxLength={40} />
                <span className="tp-hint">Uppercase letters, digits and underscores.</span>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-name">Name <span>*</span></label>
                <input id="exam-name" className="tp-input" value={examForm.name} onChange={(event) => updateExam("name", event.target.value)} required />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-short">Short name</label>
                <input id="exam-short" className="tp-input" value={examForm.shortName} onChange={(event) => updateExam("shortName", event.target.value)} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-category">Category <span>*</span></label>
                <select id="exam-category" className="tp-select" value={examForm.categoryId} onChange={(event) => updateExam("categoryId", event.target.value)} required>
                  <option value="">Select a category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="exam-description">Description</label>
                <textarea id="exam-description" className="tp-input" rows={2} value={examForm.description} onChange={(event) => updateExam("description", event.target.value)} />
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="exam-url">Official URL</label>
                <input id="exam-url" className="tp-input" value={examForm.officialUrl} onChange={(event) => updateExam("officialUrl", event.target.value)} placeholder="https://…" />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-duration">Duration (min)</label>
                <input id="exam-duration" className="tp-input" type="number" min={10} max={360} value={examForm.durationMinutes} onChange={(event) => updateExam("durationMinutes", numberValue(event.target.value, 60))} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-total">Total questions</label>
                <input id="exam-total" className="tp-input" type="number" min={1} max={300} value={examForm.totalQuestions} onChange={(event) => updateExam("totalQuestions", numberValue(event.target.value, 30))} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-daily-q">Practice set floor (questions)</label>
                <input id="exam-daily-q" className="tp-input" type="number" min={3} max={30} value={examForm.dailyTestQuestions} onChange={(event) => updateExam("dailyTestQuestions", numberValue(event.target.value, 8))} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-daily-m">Practice set floor (minutes)</label>
                <input id="exam-daily-m" className="tp-input" type="number" min={3} max={180} value={examForm.dailyTestMinutes} onChange={(event) => updateExam("dailyTestMinutes", numberValue(event.target.value, 12))} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-positive">Marks per correct</label>
                <input id="exam-positive" className="tp-input" type="number" step="0.25" min={0} max={10} value={examForm.positiveMarks} onChange={(event) => updateExam("positiveMarks", numberValue(event.target.value, 4))} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="exam-negative">Penalty per wrong</label>
                <input id="exam-negative" className="tp-input" type="number" step="0.25" min={0} max={10} value={examForm.negativeMarks} onChange={(event) => updateExam("negativeMarks", numberValue(event.target.value, 1))} />
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="exam-marking">Marking note</label>
                <input id="exam-marking" className="tp-input" value={examForm.markingNote} onChange={(event) => updateExam("markingNote", event.target.value)} placeholder="e.g. +4 for correct, −1 for wrong, 0 for unattempted" />
              </div>
              <div className="tp-field tp-span-2">
                <span className="tp-label">Subjects <span>*</span></span>
                <div className="tp-stack tp-gap-6" style={{ maxHeight: 190, overflowY: "auto", padding: "8px 10px", border: "1px solid var(--tp-line-strong)", borderRadius: 10 }}>
                  {subjects.length ? subjects.map((subject) => (
                    <label className="tp-check" key={subject.id}>
                      <input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} />
                      <span>{subject.name}</span>
                    </label>
                  )) : <p className="tp-xs tp-muted">No active subject exists yet.</p>}
                </div>
              </div>
            </div>
            <button type="submit" className="tp-btn tp-mt-16" disabled={pending}>
              {pending ? "Publishing…" : "Publish exam"} {pending ? null : <Icon name="plus" size={15} />}
            </button>
          </form>
        </section>

        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Exam categories</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>Categories group exams on the public catalogue and registration screen.</p>
          <form onSubmit={createCategory}>
            <div className="tp-form-grid">
              <div className="tp-field">
                <label className="tp-label" htmlFor="category-name">Name <span>*</span></label>
                <input
                  id="category-name"
                  className="tp-input"
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value, slug: slugify(event.target.value) }))}
                  required
                />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="category-slug">Slug <span>*</span></label>
                <input
                  id="category-slug"
                  className="tp-input"
                  value={categoryForm.slug}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
                  required
                />
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="category-description">Description</label>
                <input id="category-description" className="tp-input" value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="category-order">Sort order</label>
                <input id="category-order" className="tp-input" type="number" min={0} max={1000} value={categoryForm.order} onChange={(event) => setCategoryForm((current) => ({ ...current, order: numberValue(event.target.value, 100) }))} />
              </div>
            </div>
            <button type="submit" className="tp-btn tp-btn-soft tp-mt-16" disabled={pending}>
              Add category <Icon name="plus" size={15} />
            </button>
          </form>

          <div className="tp-divider" style={{ margin: "18px 0" }} />
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Existing categories</h3>
          <div className="tp-row tp-gap-6 tp-wrap">
            {categories.length ? categories.map((category) => (
              <span className="tp-pill" key={category.id}>{category.name} <span className="tp-faint">/{category.slug}</span></span>
            )) : <p className="tp-xs tp-muted">No category exists yet.</p>}
          </div>
        </section>
      </div>

      <section>
        <div className="tp-row-between" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Catalogue</h2>
            <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>{exams.length} exams · configuration is editable per exam</p>
          </div>
        </div>

        {exams.length ? (
          <div className="tp-stack tp-gap-12">
            {exams.map((exam) => (
              <details className="tp-card" key={exam.id}>
                <summary className="tp-row-between" style={{ padding: "16px 18px", cursor: "pointer", listStyle: "none" }}>
                  <div className="tp-row tp-gap-12" style={{ minWidth: 0 }}>
                    <span className="tp-activity-badge" style={{ margin: 0 }}><Icon name="target" size={17} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="tp-row tp-gap-8 tp-wrap">
                        <span style={{ fontWeight: 650 }}>{exam.name}</span>
                        <span className="tp-pill tp-pill-brand">{exam.code}</span>
                        {exam.active ? <span className="tp-pill tp-pill-ok">active</span> : <span className="tp-pill tp-pill-danger">archived</span>}
                      </div>
                      <div className="tp-xs tp-faint" style={{ marginTop: 4 }}>
                        {exam.category ?? "Uncategorised"} · {exam.subjectCount} subjects · {exam.questionCount} questions · {exam.dailyCount} papers · {exam.candidateCount} candidates
                      </div>
                    </div>
                  </div>
                  <span className="tp-xs tp-faint tp-nowrap">+{exam.positiveMarks} / −{exam.negativeMarks} · {exam.totalQuestions}Q official</span>
                </summary>
                <div style={{ borderTop: "1px solid var(--tp-line)", padding: "16px 18px" }}>
                  <div className="tp-row-between tp-wrap tp-gap-8" style={{ marginBottom: 14 }}>
                    <p className="tp-xs tp-faint" style={{ maxWidth: 620, lineHeight: 1.55 }}>
                      AI can draft the official paper parts and sections from the exam name and official site. The
                      result is saved as <strong>needs verification</strong> and never becomes “verified” automatically.
                    </p>
                    <AiPatternButton
                      examId={exam.id}
                      onDone={(result) => {
                        if (result.ok) {
                          setMessage(result.message);
                          setError(null);
                          router.refresh();
                        } else {
                          setError(result.message);
                          setMessage(null);
                        }
                      }}
                    />
                  </div>
                  <div className="tp-row tp-gap-6 tp-wrap tp-mb-16">
                    {exam.subjects.length ? exam.subjects.map((subject) => <span className="tp-pill" key={subject}>{subject}</span>) : <span className="tp-pill">No subjects</span>}
                    {exam.officialUrl ? (
                      <a className="tp-link tp-xs" href={exam.officialUrl} target="_blank" rel="noopener noreferrer">Official website</a>
                    ) : null}
                  </div>
                  <ExamEditForm exam={exam} onDone={(result) => {
                    if (result.ok) {
                      setMessage(result.message);
                      setError(null);
                      router.refresh();
                    } else {
                      setError(result.message);
                      setMessage(null);
                    }
                  }} />
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="tp-empty">
            <h3>No exam yet</h3>
            <p>Create the first exam above. It will appear on the public catalogue immediately.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ExamEditForm({ exam, onDone }: { exam: AdminExamRow; onDone: (result: { ok: boolean; message: string }) => void }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: exam.name,
    shortName: exam.shortName ?? "",
    description: exam.description ?? "",
    officialUrl: exam.officialUrl ?? "",
    durationMinutes: exam.durationMinutes,
    totalQuestions: exam.totalQuestions,
    dailyTestQuestions: exam.dailyTestQuestions,
    dailyTestMinutes: exam.dailyTestMinutes,
    positiveMarks: exam.positiveMarks,
    negativeMarks: exam.negativeMarks,
    markingNote: exam.markingNote ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateExamAction(exam.id, {
        ...form,
        shortName: form.shortName || undefined,
        description: form.description || undefined,
        officialUrl: form.officialUrl || undefined,
        markingNote: form.markingNote || undefined,
      });
      onDone(result);
    });
  }

  return (
    <form onSubmit={save}>
      <div className="tp-form-grid">
        <div className="tp-field">
          <label className="tp-label" htmlFor={`name-${exam.id}`}>Name</label>
          <input id={`name-${exam.id}`} className="tp-input" value={form.name} onChange={(event) => update("name", event.target.value)} required />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor={`short-${exam.id}`}>Short name</label>
          <input id={`short-${exam.id}`} className="tp-input" value={form.shortName} onChange={(event) => update("shortName", event.target.value)} />
        </div>
        <div className="tp-field tp-span-2">
          <label className="tp-label" htmlFor={`description-${exam.id}`}>Description</label>
          <textarea id={`description-${exam.id}`} className="tp-input" rows={2} value={form.description} onChange={(event) => update("description", event.target.value)} />
        </div>
        <div className="tp-field tp-span-2">
          <label className="tp-label" htmlFor={`url-${exam.id}`}>Official URL</label>
          <input id={`url-${exam.id}`} className="tp-input" value={form.officialUrl} onChange={(event) => update("officialUrl", event.target.value)} />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor={`duration-${exam.id}`}>Duration (min)</label>
          <input id={`duration-${exam.id}`} className="tp-input" type="number" min={10} max={360} value={form.durationMinutes} onChange={(event) => update("durationMinutes", numberValue(event.target.value, 60))} />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor={`total-${exam.id}`}>Total questions</label>
          <input id={`total-${exam.id}`} className="tp-input" type="number" min={1} max={300} value={form.totalQuestions} onChange={(event) => update("totalQuestions", numberValue(event.target.value, 30))} />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor={`dailyq-${exam.id}`}>Daily questions</label>
          <input id={`dailyq-${exam.id}`} className="tp-input" type="number" min={3} max={30} value={form.dailyTestQuestions} onChange={(event) => update("dailyTestQuestions", numberValue(event.target.value, 8))} />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor={`dailym-${exam.id}`}>Daily minutes</label>
          <input id={`dailym-${exam.id}`} className="tp-input" type="number" min={3} max={180} value={form.dailyTestMinutes} onChange={(event) => update("dailyTestMinutes", numberValue(event.target.value, 12))} />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor={`positive-${exam.id}`}>Marks per correct</label>
          <input id={`positive-${exam.id}`} className="tp-input" type="number" step="0.25" min={0} max={10} value={form.positiveMarks} onChange={(event) => update("positiveMarks", numberValue(event.target.value, 4))} />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor={`negative-${exam.id}`}>Penalty per wrong</label>
          <input id={`negative-${exam.id}`} className="tp-input" type="number" step="0.25" min={0} max={10} value={form.negativeMarks} onChange={(event) => update("negativeMarks", numberValue(event.target.value, 1))} />
        </div>
        <div className="tp-field tp-span-2">
          <label className="tp-label" htmlFor={`marking-${exam.id}`}>Marking note</label>
          <input id={`marking-${exam.id}`} className="tp-input" value={form.markingNote} onChange={(event) => update("markingNote", event.target.value)} />
        </div>
      </div>
      <button type="submit" className="tp-btn tp-btn-sm tp-mt-16" disabled={pending}>
        {pending ? "Saving…" : "Save configuration"} {pending ? null : <Icon name="check" size={14} />}
      </button>
    </form>
  );
}

function AiPatternButton({ examId, onDone }: { examId: string; onDone: (result: { ok: boolean; message: string }) => void }) {
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateExamPatternAction(examId);
      onDone(result);
    });
  }

  return (
    <button type="button" className="tp-btn tp-btn-soft tp-btn-sm" onClick={generate} disabled={pending}>
      {pending ? "Generating…" : "Generate pattern with AI"} {pending ? null : <Icon name="spark" size={14} />}
    </button>
  );
}
