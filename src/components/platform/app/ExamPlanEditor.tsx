"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "../Icon";
import { includedPapers } from "@/shared/daily-workload";
import { updateExamPlan } from "@/server/actions/platform";

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXTREME";

type CatalogueExam = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  subjectNames: string[];
  dailyTestQuestions: number;
  dailyTestMinutes: number;
  parts: { code: string; name: string; durationMinutes: number; totalQuestions: number; totalMarks: number; verified: boolean }[];
};

type Group = { name: string; slug: string; exams: CatalogueExam[] };

type Target = {
  examId: string;
  examName: string;
  partCode?: string;
  level: Level;
  targetYear: number;
  dailyMinutes: number;
};

const levels: { value: Level; label: string; minutes: number }[] = [
  { value: "BEGINNER", label: "Beginner", minutes: 30 },
  { value: "INTERMEDIATE", label: "Intermediate", minutes: 45 },
  { value: "ADVANCED", label: "Advanced", minutes: 90 },
  { value: "EXTREME", label: "Extreme", minutes: 120 },
];

export function ExamPlanEditor({ groups, initial, currentYear }: { groups: Group[]; initial: Target[]; currentYear: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Target[]>(initial);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const examById = useMemo(() => {
    const map = new Map<string, CatalogueExam>();
    for (const group of groups) for (const exam of group.exams) map.set(exam.id, exam);
    return map;
  }, [groups]);

  function toggle(exam: CatalogueExam) {
    setSelected((current) => {
      if (current.some((item) => item.examId === exam.id)) return current.filter((item) => item.examId !== exam.id);
      return [...current, {
        examId: exam.id,
        examName: exam.name,
        partCode: exam.parts[0]?.code,
        level: "INTERMEDIATE",
        targetYear: currentYear + 1,
        dailyMinutes: 45,
      }];
    });
  }

  function setLevel(examId: string, level: Level) {
    const minutes = levels.find((item) => item.value === level)?.minutes ?? 45;
    setSelected((current) => current.map((item) => item.examId === examId ? { ...item, level, dailyMinutes: minutes } : item));
  }

  function setField(examId: string, key: "targetYear" | "dailyMinutes", value: number) {
    setSelected((current) => current.map((item) => item.examId === examId ? { ...item, [key]: value } : item));
  }

  function save() {
    setMessage(null);
    setError(null);
    if (!selected.length) {
      setError("Keep at least one exam in your plan.");
      return;
    }
    startTransition(async () => {
      const result = await updateExamPlan(selected.map((item) => ({
        examId: item.examId,
        partCode: item.partCode,
        level: item.level,
        targetYear: item.targetYear,
        dailyMinutes: item.dailyMinutes,
      })));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("Your exam plan is saved.");
      router.refresh();
    });
  }

  return (
    <div className="tp-dash">
      <div className="tp-stack tp-gap-20">
        <section className="tp-card tp-card-pad">
          <div className="tp-row-between" style={{ marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 18 }}>Your exams</h2>
              <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>{selected.length} selected · each with its own level</p>
            </div>
            <span className="tp-pill tp-pill-brand">{selected.length}</span>
          </div>

          {selected.length ? (
            <div className="tp-stack tp-gap-16">
              {selected.map((item) => {
                const exam = examById.get(item.examId);
                return (
                  <div key={item.examId} className="tp-card" style={{ padding: 16, background: "var(--tp-surface-2)" }}>
                    <div className="tp-row-between" style={{ alignItems: "flex-start" }}>
                      <div>
                        <h3 style={{ fontSize: 16 }}>{exam?.shortName ?? item.examName}</h3>
                        <p className="tp-xs tp-faint" style={{ marginTop: 2 }}>
                          {exam ? exam.subjectNames.slice(0, 4).join(" · ") : "Exam"} ·{" "}
                          {exam?.parts[0]
                            ? `${exam.parts[0].totalQuestions}Q official paper`
                            : `${exam?.dailyTestQuestions ?? 8}Q daily`}
                        </p>
                      </div>
                      <button type="button" className="tp-btn tp-btn-danger tp-btn-sm" onClick={() => exam && toggle(exam)}>
                        Remove
                      </button>
                    </div>

                    <div className="tp-level-select">
                      {levels.map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          className="tp-level-btn"
                          data-active={item.level === level.value}
                          onClick={() => setLevel(item.examId, level.value)}
                        >
                          {level.label} · {includedPapers(level.value)}/day
                        </button>
                      ))}
                    </div>

                    {exam && exam.parts.length > 1 ? (
                      <label className="tp-xs tp-muted tp-row tp-gap-4 tp-mt-8" style={{ flexWrap: "wrap" }}>
                        Paper
                        <select
                          className="tp-select"
                          style={{ minHeight: 32, padding: "2px 28px 2px 8px", fontSize: 12, width: "auto", maxWidth: "100%" }}
                          value={item.partCode ?? exam.parts[0]?.code ?? ""}
                          onChange={(event) => setSelected((current) => current.map((entry) => entry.examId === item.examId ? { ...entry, partCode: event.target.value } : entry))}
                        >
                          {exam.parts.map((part) => (
                            <option key={part.code} value={part.code}>
                              {part.name} · {part.totalQuestions}Q / {part.totalMarks} marks
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : exam?.parts[0] ? (
                      <div className="tp-xs tp-faint tp-mt-8">
                        {exam.parts[0].name} · {exam.parts[0].totalQuestions} questions · {exam.parts[0].totalMarks} marks
                      </div>
                    ) : null}

                    <div className="tp-row tp-gap-12 tp-wrap tp-mt-8">
                      <label className="tp-xs tp-muted tp-row tp-gap-4">
                        Target year
                        <select
                          className="tp-select"
                          style={{ minHeight: 32, padding: "2px 28px 2px 8px", fontSize: 12, width: "auto" }}
                          value={item.targetYear}
                          onChange={(event) => setField(item.examId, "targetYear", Number(event.target.value))}
                        >
                          {Array.from({ length: 8 }, (_, index) => currentYear + index).map((year) => <option key={year} value={year}>{year}</option>)}
                        </select>
                      </label>
                      <label className="tp-xs tp-muted tp-row tp-gap-4">
                        Daily minutes
                        <input
                          type="number"
                          min={15}
                          max={1440}
                          className="tp-input"
                          style={{ width: 84, minHeight: 32, padding: "2px 8px", fontSize: 12 }}
                          value={item.dailyMinutes}
                          onChange={(event) => setField(item.examId, "dailyMinutes", Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="tp-small tp-muted">No exam selected. Choose at least one from the catalogue.</p>
          )}

          {message ? <div className="tp-success tp-mt-16" role="status">{message}</div> : null}
          {error ? <div className="tp-error tp-mt-16" role="alert">{error}</div> : null}

          <div className="tp-row tp-gap-8 tp-mt-16 tp-wrap">
            <button type="button" className="tp-btn" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save exam plan"} {pending ? null : <Icon name="check" size={15} />}
            </button>
            <Link className="tp-btn tp-btn-ghost" href="/app">Back to dashboard</Link>
          </div>
        </section>

        <section className="tp-card tp-card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Add another exam</h2>
          <p className="tp-xs tp-faint" style={{ marginBottom: 14 }}>Grouped by category. Each addition gets its own level.</p>

          <div className="tp-stack tp-gap-10">
            {groups.map((group) => {
              const open = openGroup === group.slug;
              const count = group.exams.filter((exam) => selected.some((item) => item.examId === exam.id)).length;
              return (
                <div className="tp-card" key={group.slug} style={{ overflow: "hidden" }}>
                  <button
                    type="button"
                    className="tp-row-between"
                    onClick={() => setOpenGroup(open ? null : group.slug)}
                    style={{ width: "100%", padding: "14px 16px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}
                  >
                    <span>
                      <span style={{ fontWeight: 650, fontSize: 14, display: "block" }}>{group.name}</span>
                      <span className="tp-xs tp-faint">{group.exams.length} exams</span>
                    </span>
                    <span className="tp-row tp-gap-8">
                      {count ? <span className="tp-pill tp-pill-brand">{count} added</span> : null}
                      <Icon name="chevron-down" size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms ease", color: "var(--tp-faint)" }} />
                    </span>
                  </button>
                  {open ? (
                    <div className="tp-stack tp-gap-8" style={{ padding: "0 16px 16px" }}>
                      {group.exams.map((exam) => {
                        const isSelected = selected.some((item) => item.examId === exam.id);
                        return (
                          <label className="tp-exam-option" data-selected={isSelected} key={exam.id}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggle(exam)} />
                            <span className="tp-grow">
                              <h4>{exam.shortName ?? exam.name}</h4>
                              <p>{exam.subjectNames.slice(0, 4).join(" · ")}</p>
                            </span>
                            <span className="tp-xs tp-faint tp-nowrap">
                              {exam.parts[0]
                                ? `${exam.parts[0].totalQuestions}Q · ${exam.parts[0].durationMinutes}m`
                                : `${exam.dailyTestQuestions}Q · ${exam.dailyTestMinutes}m`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="tp-stack tp-gap-20">
        <section className="tp-card tp-card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Preparation levels</h3>
          <div className="tp-stack tp-gap-12">
            {[
              ["Beginner", "1 full paper/day", "Build the foundation with one complete official paper."],
              ["Intermediate", "2 full papers/day", "Balance learning with consistent full-paper practice."],
              ["Advanced", "3 full papers/day", "Push speed and accuracy under exam conditions."],
              ["Extreme", "4 full papers/day", "Peak-intensity preparation with the maximum daily papers."],
            ].map(([label, minutes, body]) => (
              <div key={label}>
                <div className="tp-row-between tp-small">
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span className="tp-xs tp-faint">{minutes}</span>
                </div>
                <div className="tp-xs tp-muted" style={{ marginTop: 2 }}>{body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="tp-card tp-card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>How this affects today</h3>
          <p className="tp-small tp-muted">
            The active exam drives today&apos;s paper. The level sets how many full official papers you sit each day.
            Study minutes are your own syllabus/revision target per exam, separate from exam time.
            Paper size and marking always follow the official exam configuration.
          </p>
          <div className="tp-note tp-mt-16">
            <strong>Removing an exam</strong> stops new papers for it and hides it from the exam switcher, but keeps
            your attempts, targets, syllabus progress and notes. Add the same exam and target year again to resume
            exactly where you stopped.
          </div>
        </section>
      </aside>
    </div>
  );
}
