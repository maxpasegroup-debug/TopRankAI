"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { toast } from "../AppToaster";
import { buildCustomTest } from "@/server/actions/pro";
import type { CustomTestOptions } from "@/server/platform/custom-tests";
import { CUSTOM_TEST_MIN_QUESTIONS } from "@/shared/pro";

const difficulties = [
  { value: "ANY", label: "Any" },
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
] as const;

export function CustomTestBuilder({ code, name, options, positiveMarks, negativeMarks }: {
  code: string;
  name: string;
  options: CustomTestOptions;
  positiveMarks: number;
  negativeMarks: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"ANY" | "EASY" | "MEDIUM" | "HARD">("ANY");
  const [count, setCount] = useState(Math.min(20, Math.max(CUSTOM_TEST_MIN_QUESTIONS, options.maxQuestions)));
  const [minutes, setMinutes] = useState(Math.min(45, Math.max(10, count)));

  const available = useMemo(() => {
    const subjectCount = options.subjects.filter((subject) => subjects.includes(subject.id)).reduce((sum, subject) => sum + subject.count, 0);
    if (!subjects.length) return options.total;
    return Math.min(options.total, subjectCount);
  }, [options, subjects]);

  const maxCount = Math.min(options.maxQuestions, available);
  const disabled = pending || maxCount < CUSTOM_TEST_MIN_QUESTIONS || options.remainingToday === 0;

  function toggleSubject(id: string) {
    setSubjects((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const safeCount = Math.min(Math.max(CUSTOM_TEST_MIN_QUESTIONS, count), maxCount);
    startTransition(async () => {
      const result = await buildCustomTest({
        code,
        subjectIds: subjects,
        topicIds: topic ? [topic] : [],
        difficulty,
        count: safeCount,
        minutes: Math.max(5, Math.min(180, Math.round(minutes))),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.data.count < result.data.requested) {
        toast(`Only ${result.data.count} reviewed questions match that filter, so the paper will run ${result.data.count}.`, { icon: "⚠️" });
      } else {
        toast.success(`Your ${result.data.count}-question custom test is ready.`);
      }
      router.push(`/app/daily/${result.data.id}`);
      router.refresh();
    });
  }

  if (!options.total) {
    return (
      <div className="tp-empty">
        <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="target" /></span>
        <h3>No reviewed questions yet</h3>
        <p>The custom builder uses the same reviewed bank as your daily papers. It opens as soon as questions are published for {name}.</p>
      </div>
    );
  }

  return (
    <form className="tp-card tp-card-pad tp-custom-form" onSubmit={submit}>
      <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>Build a test</h2>
          <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>
            {options.total} reviewed questions available · {options.remainingToday} of 5 tests left today
          </p>
        </div>
        <span className="tp-pill">{name}</span>
      </div>

      <fieldset className="tp-custom-fieldset">
        <legend>Subjects</legend>
        <div className="tp-row tp-gap-8 tp-wrap">
          {options.subjects.map((subject) => (
            <button
              type="button"
              key={subject.id}
              className="tp-chip"
              data-active={subjects.includes(subject.id)}
              onClick={() => toggleSubject(subject.id)}
              disabled={pending}
            >
              {subject.name}
              <span>{subject.count}</span>
            </button>
          ))}
        </div>
        <p className="tp-xs tp-faint" style={{ marginTop: 8 }}>
          Leave every subject off to draw from the whole bank.
        </p>
      </fieldset>

      <div className="tp-custom-grid">
        <div>
          <span className="tp-label">Difficulty</span>
          <div className="tp-segmented">
            {difficulties.map((item) => (
              <button
                type="button"
                key={item.value}
                data-active={difficulty === item.value}
                onClick={() => setDifficulty(item.value)}
                disabled={pending}
              >
                {item.label}
                {item.value !== "ANY" ? <span>{options.difficulties[item.value]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="tp-label" htmlFor="custom-topic">Focus topic</label>
          <select
            id="custom-topic"
            className="tp-select"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            disabled={pending || !options.topics.length}
          >
            <option value="">Any tagged topic</option>
            {options.topics.map((item) => (
              <option key={item.id} value={item.id}>{item.title} · {item.subject} ({item.count})</option>
            ))}
          </select>
          {!options.topics.length ? <p className="tp-xs tp-faint" style={{ marginTop: 6 }}>No topic-tagged questions for this exam yet.</p> : null}
        </div>

        <div>
          <label className="tp-label" htmlFor="custom-count">Questions</label>
          <input
            id="custom-count"
            className="tp-input"
            type="number"
            min={CUSTOM_TEST_MIN_QUESTIONS}
            max={Math.max(CUSTOM_TEST_MIN_QUESTIONS, maxCount)}
            value={count}
            onChange={(event) => {
              const next = Number(event.target.value);
              setCount(Number.isFinite(next) ? next : CUSTOM_TEST_MIN_QUESTIONS);
              setMinutes(Math.max(5, Math.min(180, Math.round(next) || 10)));
            }}
            disabled={pending}
          />
          <p className="tp-xs tp-faint" style={{ marginTop: 6 }}>{maxCount} maximum for one test.</p>
        </div>

        <div>
          <label className="tp-label" htmlFor="custom-minutes">Minutes</label>
          <input
            id="custom-minutes"
            className="tp-input"
            type="number"
            min={5}
            max={180}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            disabled={pending}
          />
          <p className="tp-xs tp-faint" style={{ marginTop: 6 }}>Marking: +{positiveMarks} correct · −{negativeMarks} wrong</p>
        </div>
      </div>

      <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginTop: 20 }}>
        <p className="tp-xs tp-faint" style={{ margin: 0 }}>
          The server picks the questions, stores the paper and marks it with the same deterministic scoring as every daily paper.
        </p>
        <button type="submit" className="tp-btn" disabled={disabled}>
          {pending ? <><span className="tp-spinner" /> Building paper…</> : <>Build test <Icon name="arrow-right" size={15} /></>}
        </button>
      </div>
      {maxCount < CUSTOM_TEST_MIN_QUESTIONS ? (
        <p className="tp-field-error" style={{ marginTop: 10 }}>Not enough questions match this filter. Widen the subjects or choose any difficulty.</p>
      ) : null}
    </form>
  );
}
