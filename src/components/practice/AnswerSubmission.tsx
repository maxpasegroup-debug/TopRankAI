"use client";
import { useEffect, useState } from "react";
import type { StudentQuestionDto } from "@/server/question/service";
import { studentRequest, StudentRequestError } from "@/components/journey/client";
import { readPracticeRecovery, recoveryStorageKey, type PracticePayload } from "@/shared/practice-recovery";
type Result = { id: string; correct: boolean; score: string; maximumScore: string; explanation: string | null };
export function AnswerSubmission({ question, ownerId }: { question: StudentQuestionDto; ownerId?: string }) {
  const [options, setOptions] = useState<string[]>([]);
  const [numerical, setNumerical] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PracticePayload | null>(null);
  const [ready, setReady] = useState(false);
  const storageKey = ownerId ? recoveryStorageKey(ownerId, question.id) : null;
  useEffect(() => {
    try { if (storageKey) {
      const saved = readPracticeRecovery(sessionStorage.getItem(storageKey), question.id);
      if (saved) { setPending(saved); setOptions(saved.optionIds ?? []); setNumerical(saved.numerical ?? ""); setKey(saved.requestKey); }
      else sessionStorage.removeItem(storageKey);
    } } catch { /* Storage can be disabled; in-memory retry remains available. */ }
    setReady(true);
  }, [storageKey, question.id]);
  function clearRecovery() { setPending(null); try { if (storageKey) sessionStorage.removeItem(storageKey); } catch { /* No storage access. */ } }
  async function submit() {
    const requestKey = key || crypto.randomUUID();
    const payload: PracticePayload = pending ?? { requestKey, questionId: question.id, ...(question.type === "NUMERICAL" ? { numerical } : { optionIds: options }) };
    setKey(payload.requestKey); setPending(payload); setBusy(true); setError("");
    try { if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), payload })); } catch { /* Keep the same request in memory. */ }
    try { setResult(await studentRequest<Result>("/api/student/practice/attempts", "POST", payload)); clearRecovery(); }
    catch (e) {
      if (e instanceof StudentRequestError && [400, 413, 415].includes(e.status)) { clearRecovery(); setKey(""); }
      setError(e instanceof Error ? e.message : "Unable to submit");
    } finally { setBusy(false); }
  }
  return <section className="journey-shell"><h2>Your answer</h2>
    {question.type === "NUMERICAL" ? <label className="journey-field">Numerical answer<input inputMode="decimal" maxLength={60} disabled={!ready || busy || Boolean(result) || Boolean(pending)} value={numerical} onChange={(e) => { setNumerical(e.target.value); setKey(""); }} /></label> : <fieldset className="journey-answer-options"><legend>{question.type === "SINGLE_CHOICE" ? "Choose one answer" : "Choose all applicable answers"}</legend>{question.options.map((option) => <label key={option.id}><input type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} name={`answer-${question.id}`} disabled={!ready || busy || Boolean(result) || Boolean(pending)} checked={options.includes(option.id)} onChange={(e) => { setOptions(question.type === "SINGLE_CHOICE" ? [option.id] : e.target.checked ? [...options, option.id] : options.filter((id) => id !== option.id)); setKey(""); }} />{option.code}. {option.text}</label>)}</fieldset>}
    {error && <p className="journey-error" role="alert">{error}</p>}
    {pending && !busy && <p role="status">Submission awaiting confirmation.</p>}
    {result ? <div role="status"><h2>{result.correct ? "Correct" : "Not quite"}</h2><p>Score: {result.score} / {result.maximumScore}</p>{result.explanation && <p>{result.explanation}</p>}<a href="/practice/revision">Review mistakes and bookmarks</a><button onClick={() => { setResult(null); setOptions([]); setNumerical(""); setKey(""); }}>Try again</button></div> : <button className="journey-primary" disabled={!ready || busy || (question.type === "NUMERICAL" ? !numerical.trim() : !options.length)} onClick={() => void submit()}>{busy ? "Submitting..." : pending ? "Confirm submission" : "Submit answer"}</button>}
  </section>;
}
