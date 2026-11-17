"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { useToastFeedback } from "../useToastFeedback";
import {
  approveQuestionAction,
  archiveQuestionAction,
  createQuestionAction,
  generateAiDraftsAction,
} from "@/server/actions/admin";

export type AdminQuestionTopic = { id: string; title: string; subjectId: string; examId: string };

export type AdminQuestionRow = {
  id: string;
  code: string;
  text: string;
  type: string;
  difficulty: string;
  status: string;
  reviewStatus: string;
  active: boolean;
  sourceType: string;
  subject: string;
  topic: string | null;
  marks: number;
  negativeMarks: number;
  options: { id: string; code: string; text: string; isCorrect: boolean }[];
  exams: string[];
};

export type AdminQuestionExam = { id: string; code: string; name: string };

const emptyOptions = () => [
  { text: "", correct: true },
  { text: "", correct: false },
  { text: "", correct: false },
  { text: "", correct: false },
];

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function QuestionAdmin({
  questions,
  subjects,
  exams,
  topics,
}: {
  questions: AdminQuestionRow[];
  subjects: { id: string; name: string }[];
  exams: AdminQuestionExam[];
  topics: AdminQuestionTopic[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED">("ALL");
  useToastFeedback(message, setMessage, error, setError);

  const [form, setForm] = useState({
    code: "",
    text: "",
    type: "SINGLE_CHOICE" as "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "NUMERICAL",
    difficulty: "MEDIUM" as "EASY" | "MEDIUM" | "HARD",
    subjectId: subjects[0]?.id ?? "",
    topicId: "",
    explanation: "",
    numericalAnswer: "",
    marks: 4,
    negativeMarks: 1,
  });
  const [options, setOptions] = useState(emptyOptions());
  const [examIds, setExamIds] = useState<string[]>(exams[0] ? [exams[0].id] : []);

  const [aiForm, setAiForm] = useState({
    examId: exams[0]?.id ?? "",
    subjectId: subjects[0]?.id ?? "",
    topicId: "",
    difficulty: "MEDIUM" as "EASY" | "MEDIUM" | "HARD",
    count: 2,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      if (filter !== "ALL" && question.reviewStatus !== filter && question.status !== filter) return false;
      if (!query) return true;
      return [question.code, question.text, question.subject, question.topic ?? "", ...question.exams]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [questions, search, filter]);

  const aiTopics = useMemo(
    () => topics.filter((topic) => topic.examId === aiForm.examId && topic.subjectId === aiForm.subjectId),
    [topics, aiForm.examId, aiForm.subjectId],
  );

  function updateOption(index: number, key: "text" | "correct", value: string | boolean) {
    setOptions((current) => {
      if (key === "correct") {
        return current.map((option, optionIndex) => {
          if (form.type === "SINGLE_CHOICE") return { ...option, correct: optionIndex === index };
          return optionIndex === index ? { ...option, correct: Boolean(value) } : option;
        });
      }
      return current.map((option, optionIndex) => (optionIndex === index ? { ...option, text: String(value) } : option));
    });
  }

  function createQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!examIds.length) {
      setError("Map the question to at least one exam.");
      return;
    }
    if (form.type !== "NUMERICAL") {
      const chosen = options.filter((option) => option.correct);
      if (form.type === "SINGLE_CHOICE" && chosen.length !== 1) {
        setError("A single-choice question needs exactly one correct option.");
        return;
      }
      if (!chosen.length) {
        setError("Mark at least one option as correct.");
        return;
      }
      if (options.some((option) => !option.text.trim())) {
        setError("Every option needs text.");
        return;
      }
    }
    startTransition(async () => {
      const result = await createQuestionAction({
        ...form,
        topicId: form.topicId || undefined,
        numericalAnswer: form.numericalAnswer || undefined,
        options: form.type === "NUMERICAL" ? [] : options,
        examIds,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setForm((current) => ({ ...current, code: "", text: "", explanation: "", numericalAnswer: "" }));
      setOptions(emptyOptions());
      router.refresh();
    });
  }

  function generateDrafts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!aiForm.topicId) {
      setError("Choose a syllabus topic for the AI drafts.");
      return;
    }
    startTransition(async () => {
      const result = await generateAiDraftsAction(aiForm);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  function review(questionId: string, action: "approve" | "archive") {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = action === "approve" ? await approveQuestionAction(questionId) : await archiveQuestionAction(questionId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  const counts = useMemo(() => {
    const result = { ALL: questions.length, NEEDS_REVIEW: 0, PUBLISHED: 0, ARCHIVED: 0 };
    for (const question of questions) {
      if (question.reviewStatus === "NEEDS_REVIEW") result.NEEDS_REVIEW += 1;
      if (question.status === "PUBLISHED") result.PUBLISHED += 1;
      if (question.status === "ARCHIVED") result.ARCHIVED += 1;
    }
    return result;
  }, [questions]);

  return (
    <div className="tp-stack tp-gap-20">
      <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Manual question editor</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>
            AI drafts are the primary path. Use this editor to fix a specific question or add one the AI missed.
          </p>
          <form onSubmit={createQuestion}>
            <div className="tp-form-grid">
              <div className="tp-field">
                <label className="tp-label" htmlFor="q-code">Code <span>*</span></label>
                <input id="q-code" className="tp-input" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="SSC_CGL_QUANT_0001" required />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="q-type">Type</label>
                <select id="q-type" className="tp-select" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as typeof current.type }))}>
                  <option value="SINGLE_CHOICE">Single choice</option>
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                  <option value="NUMERICAL">Numerical</option>
                </select>
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="q-text">Question <span>*</span></label>
                <textarea id="q-text" className="tp-input" rows={3} value={form.text} onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))} required minLength={10} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="q-difficulty">Difficulty</label>
                <select id="q-difficulty" className="tp-select" value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as typeof current.difficulty }))}>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="q-subject">Subject <span>*</span></label>
                <select id="q-subject" className="tp-select" value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, topicId: "" }))} required>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="q-topic">Syllabus topic</label>
                <select id="q-topic" className="tp-select" value={form.topicId} onChange={(event) => setForm((current) => ({ ...current, topicId: event.target.value }))}>
                  <option value="">Not mapped</option>
                  {topics.filter((topic) => topic.subjectId === form.subjectId && examIds.includes(topic.examId)).map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.title}</option>
                  ))}
                </select>
                <span className="tp-hint">Only topics from the selected exams are listed.</span>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="q-marks">Marks</label>
                <input id="q-marks" className="tp-input" type="number" step="0.25" min={0} max={20} value={form.marks} onChange={(event) => setForm((current) => ({ ...current, marks: numberValue(event.target.value, 4) }))} />
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="q-negative">Penalty</label>
                <input id="q-negative" className="tp-input" type="number" step="0.25" min={0} max={20} value={form.negativeMarks} onChange={(event) => setForm((current) => ({ ...current, negativeMarks: numberValue(event.target.value, 1) }))} />
              </div>
              <div className="tp-field tp-span-2">
                <span className="tp-label">Exams <span>*</span></span>
                <div className="tp-stack tp-gap-4" style={{ maxHeight: 140, overflowY: "auto", padding: "8px 10px", border: "1px solid var(--tp-line-strong)", borderRadius: 10 }}>
                  {exams.map((exam) => (
                    <label className="tp-check" key={exam.id}>
                      <input
                        type="checkbox"
                        checked={examIds.includes(exam.id)}
                        onChange={() => setExamIds((current) => (current.includes(exam.id) ? current.filter((id) => id !== exam.id) : [...current, exam.id]))}
                      />
                      <span>{exam.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.type === "NUMERICAL" ? (
                <div className="tp-field tp-span-2">
                  <label className="tp-label" htmlFor="q-numeric">Correct numerical answer</label>
                  <input id="q-numeric" className="tp-input" value={form.numericalAnswer} onChange={(event) => setForm((current) => ({ ...current, numericalAnswer: event.target.value }))} required />
                </div>
              ) : (
                <div className="tp-field tp-span-2">
                  <span className="tp-label">Options <span>*</span></span>
                  <div className="tp-stack tp-gap-8">
                    {options.map((option, index) => (
                      <div className="tp-row tp-gap-8" key={index}>
                        <label className="tp-check" title="Mark as correct">
                          <input
                            type={form.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                            name="correct-option"
                            checked={option.correct}
                            onChange={(event) => updateOption(index, "correct", form.type === "MULTIPLE_CHOICE" ? event.target.checked : true)}
                          />
                        </label>
                        <span className="tp-pill" style={{ flex: "none" }}>{String.fromCharCode(65 + index)}</span>
                        <input
                          className="tp-input"
                          value={option.text}
                          onChange={(event) => updateOption(index, "text", event.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        />
                      </div>
                    ))}
                  </div>
                  <span className="tp-hint">Tick the correct option{form.type === "MULTIPLE_CHOICE" ? "s" : ""}. Unused options can be left blank only for multiple choice.</span>
                </div>
              )}

              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="q-explanation">Explanation <span>*</span></label>
                <textarea id="q-explanation" className="tp-input" rows={3} value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} required minLength={10} />
              </div>
            </div>
            <button type="submit" className="tp-btn tp-mt-16" disabled={pending}>
              {pending ? "Publishing…" : "Publish question"} {pending ? null : <Icon name="check" size={15} />}
            </button>
          </form>
        </section>

        <section className="tp-card tp-card-pad">
          <div className="tp-row-between" style={{ marginBottom: 4 }}>
            <h2 style={{ fontSize: 18 }}>AI question drafts</h2>
            <span className="tp-pill tp-pill-brand"><Icon name="spark" size={13} /> review required</span>
          </div>
          <p className="tp-xs tp-faint" style={{ marginBottom: 16 }}>
            Drafts are saved as <strong>needs review</strong>. They never enter a live paper until an administrator approves them.
          </p>
          <form onSubmit={generateDrafts}>
            <div className="tp-form-grid">
              <div className="tp-field">
                <label className="tp-label" htmlFor="ai-exam">Exam</label>
                <select id="ai-exam" className="tp-select" value={aiForm.examId} onChange={(event) => setAiForm((current) => ({ ...current, examId: event.target.value, topicId: "" }))}>
                  {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                </select>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="ai-subject">Subject</label>
                <select id="ai-subject" className="tp-select" value={aiForm.subjectId} onChange={(event) => setAiForm((current) => ({ ...current, subjectId: event.target.value, topicId: "" }))}>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </div>
              <div className="tp-field tp-span-2">
                <label className="tp-label" htmlFor="ai-topic">Topic</label>
                <select id="ai-topic" className="tp-select" value={aiForm.topicId} onChange={(event) => setAiForm((current) => ({ ...current, topicId: event.target.value }))}>
                  <option value="">Select a topic</option>
                  {aiTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                </select>
                <span className="tp-hint">{aiTopics.length} topics mapped to this exam and subject.</span>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="ai-difficulty">Difficulty</label>
                <select id="ai-difficulty" className="tp-select" value={aiForm.difficulty} onChange={(event) => setAiForm((current) => ({ ...current, difficulty: event.target.value as typeof current.difficulty }))}>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div className="tp-field">
                <label className="tp-label" htmlFor="ai-count">How many</label>
                <input id="ai-count" className="tp-input" type="number" min={1} max={10} value={aiForm.count} onChange={(event) => setAiForm((current) => ({ ...current, count: numberValue(event.target.value, 2) }))} />
              </div>
            </div>
            <button type="submit" className="tp-btn tp-btn-soft tp-mt-16" disabled={pending}>
              {pending ? "Generating…" : "Generate drafts"} {pending ? null : <Icon name="spark" size={15} />}
            </button>
          </form>
          <div className="tp-note tp-mt-16">
            <strong>Provider.</strong> Google Gemini through <code>GEMINI_API_KEY</code>. When it is not configured the
            action returns an honest error instead of inventing questions.
          </div>
        </section>
      </div>

      <section>
        <div className="tp-row-between tp-wrap tp-gap-12" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Question bank</h2>
            <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>{filtered.length} shown of {questions.length} most recent</p>
          </div>
          <div className="tp-row tp-gap-8 tp-wrap">
            <div className="tp-tabs">
              {(["ALL", "NEEDS_REVIEW", "PUBLISHED", "ARCHIVED"] as const).map((key) => (
                <button key={key} type="button" className="tp-tab" data-active={filter === key} onClick={() => setFilter(key)}>
                  {key === "ALL" ? "All" : key === "NEEDS_REVIEW" ? "Needs review" : key === "PUBLISHED" ? "Published" : "Archived"} ({counts[key]})
                </button>
              ))}
            </div>
            <input className="tp-input" style={{ maxWidth: 230, minHeight: 38 }} placeholder="Search code or text" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>

        {filtered.length ? (
          <div className="tp-stack tp-gap-10">
            {filtered.map((question) => (
              <article className="tp-card tp-card-pad" key={question.id}>
                <div className="tp-row-between tp-wrap tp-gap-8" style={{ alignItems: "flex-start" }}>
                  <div className="tp-row tp-gap-8 tp-wrap">
                    <span className="tp-pill tp-pill-brand">{question.code}</span>
                    <span className="tp-pill">{question.subject}</span>
                    {question.topic ? <span className="tp-pill">{question.topic}</span> : null}
                    <span className={`tp-pill ${question.reviewStatus === "REVIEWED" ? "tp-pill-ok" : "tp-pill-warn"}`}>{question.reviewStatus.replace(/_/g, " ").toLowerCase()}</span>
                    <span className={`tp-pill ${question.status === "PUBLISHED" ? "tp-pill-ok" : question.status === "ARCHIVED" ? "tp-pill-danger" : ""}`}>{question.status.toLowerCase()}</span>
                    {question.sourceType === "AI_GENERATED" ? <span className="tp-pill tp-pill-accent">AI draft</span> : null}
                  </div>
                  <div className="tp-row tp-gap-8">
                    {question.status !== "PUBLISHED" ? (
                      <button type="button" className="tp-btn tp-btn-soft tp-btn-sm" onClick={() => review(question.id, "approve")} disabled={pending}>
                        <Icon name="check" size={13} /> Approve
                      </button>
                    ) : null}
                    {question.active ? (
                      <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => review(question.id, "archive")} disabled={pending}>
                        Archive
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="tp-small" style={{ margin: "10px 0", fontWeight: 550 }}>{question.text}</p>
                <div className="tp-grid tp-grid-2" style={{ gap: 10 }}>
                  {question.options.map((option) => (
                    <div className="tp-row tp-gap-8 tp-xs" key={option.id}>
                      <span className={`tp-pill ${option.isCorrect ? "tp-pill-ok" : ""}`}>{option.code}</span>
                      <span className={option.isCorrect ? "" : "tp-muted"}>{option.text}</span>
                    </div>
                  ))}
                </div>
                <div className="tp-xs tp-faint" style={{ marginTop: 8 }}>
                  {question.type.replace(/_/g, " ").toLowerCase()} · {question.difficulty.toLowerCase()} · +{question.marks} / −{question.negativeMarks} · {question.exams.join(", ") || "No exam"}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tp-empty">
            <h3>No question matches</h3>
            <p>Adjust the filter or write a new question above.</p>
          </div>
        )}
      </section>
    </div>
  );
}
