"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "../Icon";
import { confirmAction, toast } from "../AppToaster";
import { TimerNotice, type TimerNoticeData } from "./TimerNotice";
import { submitExamAttempt } from "@/server/actions/platform";

const PALETTE_PAGE_SIZE = 25;
const STRIP_PAGE_SIZE = 8;

type PaperQuestion = {
  position: number;
  id: string;
  text: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "NUMERICAL" | string;
  difficulty: string;
  subject: string;
  topic: string | null;
  options: { id: string; code: string; text: string }[];
};

type AnswerState = { selected: string[]; flagged: boolean; timeSpentSeconds: number };

const TIME_WARNINGS = [
  { seconds: 600, level: "info" as const, title: "10 minutes left", detail: "Finish the sections you have not touched yet — the palette still marks every unanswered question." },
  { seconds: 300, level: "warn" as const, title: "5 minutes left", detail: "Commit to your best answers. You can still change them until the clock hits zero." },
  { seconds: 60, level: "danger" as const, title: "1 minute left", detail: "Check your flagged questions now. The paper submits itself when the timer ends." },
  { seconds: 30, level: "danger" as const, title: "30 seconds left", detail: "Last pass. Unanswered questions stay blank and carry no penalty." },
  { seconds: 5, level: "critical" as const, title: "5 seconds left", detail: "Scoring starts automatically in a moment." },
];

export function DailyPlayer({
  dailyExamId,
  attemptId,
  paper,
  remainingSeconds,
  durationMinutes,
  totalMarks,
}: {
  dailyExamId: string;
  attemptId: string;
  paper: PaperQuestion[];
  remainingSeconds: number;
  durationMinutes: number;
  totalMarks: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [remaining, setRemaining] = useState(remainingSeconds);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const initial: Record<string, AnswerState> = {};
    for (const question of paper) initial[question.id] = { selected: [], flagged: false, timeSpentSeconds: 0 };
    return initial;
  });
  const [hydrated, setHydrated] = useState(false);
  const [palettePage, setPalettePage] = useState(0);
  const [stripPage, setStripPage] = useState(0);
  const [timeNotice, setTimeNotice] = useState<TimerNoticeData | null>(null);
  const noticeSeq = useRef(0);
  const previousRemaining = useRef(remainingSeconds);
  const submittedRef = useRef(false);
  const questionEnteredAt = useRef(Date.now());
  const storageKey = `toprank_attempt_${attemptId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { answers?: Record<string, AnswerState>; index?: number };
        const valid = new Set(paper.map((question) => question.id));
        if (saved.answers) {
          setAnswers((current) => {
            const next = { ...current };
            for (const [id, state] of Object.entries(saved.answers ?? {})) {
              if (!valid.has(id) || !state || !Array.isArray(state.selected)) continue;
              next[id] = {
                selected: state.selected.map(String),
                flagged: Boolean(state.flagged),
                timeSpentSeconds: Number(state.timeSpentSeconds) || 0,
              };
            }
            return next;
          });
        }
        if (typeof saved.index === "number") {
          const restored = Math.max(0, Math.min(paper.length - 1, saved.index));
          setIndex(restored);
          setPalettePage(Math.floor(restored / PALETTE_PAGE_SIZE));
        }
      }
    } catch {
      // A corrupt local snapshot should never block the paper.
    }
    setHydrated(true);
  }, [storageKey, paper]);

  useEffect(() => {
    if (!hydrated || submittedRef.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ answers, index }));
    } catch {
      // Storage can be unavailable in private mode; the paper still works for this session.
    }
  }, [answers, index, hydrated, storageKey]);

  useEffect(() => {
    setStripPage(Math.floor(index / STRIP_PAGE_SIZE));
  }, [index]);

  const current = paper[index];

  const answeredCount = useMemo(
    () => paper.filter((question) => (answers[question.id]?.selected.length ?? 0) > 0).length,
    [answers, paper],
  );
  const flaggedCount = useMemo(
    () => paper.filter((question) => answers[question.id]?.flagged).length,
    [answers, paper],
  );
  const palettePageCount = Math.max(1, Math.ceil(paper.length / PALETTE_PAGE_SIZE));
  const paletteStart = palettePage * PALETTE_PAGE_SIZE;
  const paletteEnd = Math.min(paper.length, paletteStart + PALETTE_PAGE_SIZE);
  const paletteQuestions = paper.slice(paletteStart, paletteEnd);
  const stripPageCount = Math.max(1, Math.ceil(paper.length / STRIP_PAGE_SIZE));
  const stripStart = stripPage * STRIP_PAGE_SIZE;
  const stripEnd = Math.min(paper.length, stripStart + STRIP_PAGE_SIZE);
  const stripQuestions = paper.slice(stripStart, stripEnd);

  const submit = useCallback(
    (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const toastId = toast.loading(auto ? "Time is up. Scoring your paper…" : "Scoring your paper…");
      const payload = paper.map((question) => {
        const state = answers[question.id];
        return {
          questionId: question.id,
          selected: state?.selected ?? [],
          timeSpentSeconds: state?.timeSpentSeconds ?? 0,
          flagged: state?.flagged ?? false,
        };
      });
      startTransition(async () => {
        const result = await submitExamAttempt(attemptId, payload);
        if (!result.ok) {
          submittedRef.current = false;
          toast.error(result.message, { id: toastId });
          return;
        }
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // Ignore storage cleanup failures.
        }
        toast.success("Paper submitted. Opening your result…", { id: toastId });
        router.replace(`/app/daily/${dailyExamId}/result`);
      });
    },
    [answers, attemptId, dailyExamId, paper, router, storageKey],
  );

  const confirmSubmit = useCallback(async () => {
    if (pending || submittedRef.current) return;
    const confirmed = await confirmAction({
      title: "Submit this paper?",
      description: `You answered ${answeredCount} of ${paper.length} questions and flagged ${flaggedCount}. Once submitted, the paper is scored immediately and cannot be reopened.`,
      confirmLabel: "Submit and score",
      cancelLabel: "Keep working",
    });
    if (confirmed) submit(false);
  }, [answeredCount, flaggedCount, paper.length, pending, submit]);

  useEffect(() => {
    const deadline = Date.now() + remainingSeconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  useEffect(() => {
    const previous = previousRemaining.current;
    previousRemaining.current = remaining;
    if (submittedRef.current || previous === remaining) return;

    if (remaining === 0) {
      noticeSeq.current += 1;
      setTimeNotice({
        id: noticeSeq.current,
        level: "over",
        title: "Time is up",
        detail: "Your paper is being scored. The result opens automatically.",
      });
      return;
    }

    const crossed = TIME_WARNINGS.filter((warning) => previous > warning.seconds && remaining <= warning.seconds);
    if (!crossed.length) return;
    // Tiers run high to low, so the last crossed tier is the most urgent one.
    const warning = crossed[crossed.length - 1];
    noticeSeq.current += 1;
    setTimeNotice({ id: noticeSeq.current, level: warning.level, title: warning.title, detail: warning.detail });
    if (warning.seconds <= 60 && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(warning.seconds <= 5 ? [90, 60, 90] : 110);
    }
  }, [remaining]);

  useEffect(() => {
    if (!timeNotice || timeNotice.level === "over") return;
    const timer = window.setTimeout(() => setTimeNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [timeNotice]);

  useEffect(() => {
    if (remaining !== 0) return;
    // Let the closing notice animate before the result opens. The question area is
    // locked at zero, so nobody can answer while this short pause runs.
    const timer = window.setTimeout(() => void submit(true), 1500);
    return () => window.clearTimeout(timer);
  }, [remaining, submit]);

  function recordTime() {
    const spent = Math.round((Date.now() - questionEnteredAt.current) / 1000);
    questionEnteredAt.current = Date.now();
    if (!current || spent <= 0) return;
    setAnswers((state) => ({
      ...state,
      [current.id]: { ...state[current.id], timeSpentSeconds: (state[current.id]?.timeSpentSeconds ?? 0) + spent },
    }));
  }

  function goTo(next: number) {
    recordTime();
    const target = Math.max(0, Math.min(paper.length - 1, next));
    setIndex(target);
    setPalettePage(Math.floor(target / PALETTE_PAGE_SIZE));
  }

  function choose(question: PaperQuestion, optionId: string) {
    setAnswers((state) => {
      const existing = state[question.id] ?? { selected: [], flagged: false, timeSpentSeconds: 0 };
      if (question.type === "MULTIPLE_CHOICE") {
        const selected = existing.selected.includes(optionId)
          ? existing.selected.filter((id) => id !== optionId)
          : [...existing.selected, optionId];
        return { ...state, [question.id]: { ...existing, selected } };
      }
      return { ...state, [question.id]: { ...existing, selected: [optionId] } };
    });
  }

  function setNumerical(question: PaperQuestion, value: string) {
    setAnswers((state) => {
      const existing = state[question.id] ?? { selected: [], flagged: false, timeSpentSeconds: 0 };
      return { ...state, [question.id]: { ...existing, selected: value.trim() ? [value] : [] } };
    });
  }

  function toggleFlag() {
    if (!current) return;
    setAnswers((state) => ({
      ...state,
      [current.id]: { ...state[current.id], flagged: !state[current.id]?.flagged },
    }));
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const locked = remaining === 0;

  if (!current) return null;

  return (
    <div className="tp-player" data-locked={locked ? "true" : undefined}>
      <div className="tp-stack tp-gap-16">
        <div className="tp-card tp-card-pad" style={{ padding: "14px 18px" }}>
          <div className="tp-row-between" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="tp-row tp-gap-8 tp-wrap">
              <span className="tp-pill tp-pill-brand">Question {index + 1} of {paper.length}</span>
              <span className="tp-pill">{current.subject}</span>
              <span className="tp-pill tp-capitalize">{current.difficulty.toLowerCase()}</span>
            </div>
            <div className="tp-row tp-gap-8">
              <span className="tp-timer" data-urgent={remaining <= 60} data-critical={remaining <= 30}>
                <Icon name="clock" size={14} /> {minutes}:{String(seconds).padStart(2, "0")}
              </span>
              <button
                type="button"
                className="tp-btn tp-btn-accent tp-btn-sm"
                onClick={() => void confirmSubmit()}
                disabled={pending || locked}
              >
                {pending ? "Scoring…" : "Submit"}
              </button>
            </div>
          </div>
          <div className="tp-meter tp-mt-16"><span style={{ width: `${((index + 1) / paper.length) * 100}%` }} /></div>
        </div>

        <div className="tp-question-strip" aria-label="Question navigator">
          <div className="tp-question-strip-head">
            <span className="tp-question-strip-title"><Icon name="layers" size={13} /> Questions</span>
            <span className="tp-question-strip-count">{answeredCount}/{paper.length} answered</span>
          </div>
          <div className="tp-question-strip-row">
            {stripPageCount > 1 ? (
              <button
                type="button"
                className="tp-strip-arrow"
                onClick={() => setStripPage((pageNo) => Math.max(0, pageNo - 1))}
                disabled={stripPage === 0}
                aria-label="Previous questions"
              >
                <Icon name="arrow-left" size={13} />
              </button>
            ) : null}
            <div className="tp-question-strip-chips">
              {stripQuestions.map((question, offset) => {
                const questionIndex = stripStart + offset;
                const state = answers[question.id];
                const chipState = questionIndex === index
                  ? "current"
                  : state?.flagged
                    ? "flagged"
                    : (state?.selected.length ?? 0) > 0
                      ? "answered"
                      : "unanswered";
                return (
                  <button
                    type="button"
                    key={question.id}
                    className="tp-strip-chip"
                    data-state={chipState}
                    onClick={() => goTo(questionIndex)}
                    aria-current={questionIndex === index ? "true" : undefined}
                    aria-label={`Question ${questionIndex + 1}${chipState === "answered" ? ", answered" : ""}${chipState === "flagged" ? ", flagged" : ""}`}
                  >
                    {questionIndex + 1}
                  </button>
                );
              })}
            </div>
            {stripPageCount > 1 ? (
              <button
                type="button"
                className="tp-strip-arrow"
                onClick={() => setStripPage((pageNo) => Math.min(stripPageCount - 1, pageNo + 1))}
                disabled={stripPage === stripPageCount - 1}
                aria-label="Next questions"
              >
                <Icon name="arrow-right" size={13} />
              </button>
            ) : null}
          </div>
          <p className="tp-question-strip-meta">
            Questions {stripStart + 1}–{stripEnd} of {paper.length}
            {stripPageCount > 1 ? ` · set ${stripPage + 1} of ${stripPageCount}` : ""}
          </p>
        </div>

        {timeNotice ? <TimerNotice key={timeNotice.id} notice={timeNotice} onDismiss={() => setTimeNotice(null)} /> : null}

        <div className="tp-card tp-question">
          <div className="tp-question-head">
            <span className="tp-pill">{current.topic ?? "General"}</span>
            {current.type === "MULTIPLE_CHOICE" ? <span className="tp-pill tp-pill-accent">Multiple correct options</span> : null}
          </div>
          <p className="tp-question-text">{current.text}</p>

          {current.type === "NUMERICAL" ? (
            <div className="tp-field tp-mt-24">
              <label className="tp-label" htmlFor={`numeric-${current.id}`}>Your answer</label>
              <input
                id={`numeric-${current.id}`}
                className="tp-input"
                inputMode="decimal"
                value={answers[current.id]?.selected[0] ?? ""}
                onChange={(event) => setNumerical(current, event.target.value)}
                placeholder="Enter a number"
              />
              <span className="tp-hint">Numerical answers are compared with a tolerance of 1e-6.</span>
            </div>
          ) : (
            <div className="tp-options" role={current.type === "MULTIPLE_CHOICE" ? "group" : "radiogroup"} aria-label="Answer options">
              {current.options.map((option, optionIndex) => {
                const selected = answers[current.id]?.selected.includes(option.id) ?? false;
                return (
                  <button
                    type="button"
                    className="tp-option"
                    key={option.id}
                    data-selected={selected}
                    onClick={() => choose(current, option.id)}
                    aria-pressed={selected}
                  >
                    <span className="tp-option-key">{String.fromCharCode(65 + optionIndex)}</span>
                    <span className="tp-option-text">{option.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {current.type === "MULTIPLE_CHOICE" ? (
            <p className="tp-hint tp-mt-16">This question has more than one correct option. Select every option that applies.</p>
          ) : null}

          <div className="tp-row-between tp-question-actions">
            <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={toggleFlag}>
              <Icon name="flag" size={14} /> {answers[current.id]?.flagged ? "Unflag" : "Flag for review"}
            </button>
            <div className="tp-row tp-gap-8">
              <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
                <Icon name="arrow-left" size={14} /> Previous
              </button>
              <button type="button" className="tp-btn tp-btn-sm" onClick={() => goTo(index + 1)} disabled={index === paper.length - 1}>
                Next <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="tp-card tp-card-pad tp-palette">
        <div className="tp-row-between tp-palette-head">
          <h3 style={{ fontSize: 15 }}>Question palette</h3>
          <span className="tp-xs tp-faint">{answeredCount}/{paper.length}</span>
        </div>
        <div className="tp-xs tp-faint tp-palette-head" style={{ marginTop: 2 }}>{totalMarks} total marks · {durationMinutes} min</div>
        <div className="tp-palette-grid">
          {paletteQuestions.map((question, offset) => {
            const questionIndex = paletteStart + offset;
            const state = answers[question.id];
            const paletteState = questionIndex === index
              ? "current"
              : state?.flagged
                ? "flagged"
                : (state?.selected.length ?? 0) > 0
                  ? "answered"
                  : "unanswered";
            return (
              <button
                type="button"
                key={question.id}
                className="tp-palette-key"
                data-state={paletteState}
                onClick={() => goTo(questionIndex)}
                aria-label={`Question ${questionIndex + 1}${paletteState === "answered" ? ", answered" : ""}${paletteState === "flagged" ? ", flagged" : ""}`}
              >
                {questionIndex + 1}
              </button>
            );
          })}
        </div>

        {palettePageCount > 1 ? (
          <div className="tp-palette-pager">
            <div className="tp-pager tp-mt-12">
              <button
                type="button"
                className="tp-pager-link"
                onClick={() => setPalettePage((page) => Math.max(0, page - 1))}
                disabled={palettePage === 0}
                aria-label="Previous palette page"
              >
                <Icon name="arrow-left" size={13} />
              </button>
              {Array.from({ length: palettePageCount }, (_, page) => (
                <button
                  type="button"
                  key={page}
                  className="tp-pager-link"
                  data-active={page === palettePage}
                  onClick={() => setPalettePage(page)}
                  aria-label={`Palette page ${page + 1}`}
                  aria-current={page === palettePage ? "page" : undefined}
                >
                  {page + 1}
                </button>
              ))}
              <button
                type="button"
                className="tp-pager-link"
                onClick={() => setPalettePage((page) => Math.min(palettePageCount - 1, page + 1))}
                disabled={palettePage === palettePageCount - 1}
                aria-label="Next palette page"
              >
                <Icon name="arrow-right" size={13} />
              </button>
            </div>
            <p className="tp-xs tp-faint tp-mt-8">
              Questions {paletteStart + 1}–{paletteEnd} of {paper.length}
            </p>
          </div>
        ) : null}

        <div className="tp-stack tp-gap-8 tp-mt-16">
          <div className="tp-row tp-gap-8 tp-xs tp-muted"><span className="tp-pill tp-pill-ok" style={{ width: 14, height: 14, padding: 0, borderRadius: 4 }} /> Answered</div>
          <div className="tp-row tp-gap-8 tp-xs tp-muted"><span className="tp-pill tp-pill-warn" style={{ width: 14, height: 14, padding: 0, borderRadius: 4 }} /> Flagged</div>
          <div className="tp-row tp-gap-8 tp-xs tp-muted"><span className="tp-pill" style={{ width: 14, height: 14, padding: 0, borderRadius: 4 }} /> Not answered</div>
        </div>

        <button type="button" className="tp-btn tp-btn-accent tp-btn-block tp-mt-16" onClick={() => void confirmSubmit()} disabled={pending || locked}>
          {pending ? "Scoring…" : "Submit paper"}
        </button>
        <p className="tp-xs tp-faint tp-mt-8" style={{ lineHeight: 1.5 }}>
          The server closes this paper at {durationMinutes} minutes. Unanswered questions carry no penalty.
          Your selections are saved on this device until you submit.
        </p>
      </aside>
    </div>
  );
}
