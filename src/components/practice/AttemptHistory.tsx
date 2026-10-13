"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { studentRequest } from "@/components/journey/client";
type Attempt = { id: string; questionId: string; questionText: string; score: string; maximumScore: string;
  correct: boolean; explanation: string | null; submittedAt: string };
export function AttemptHistory() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function load(next?: string) { setBusy(true); setError(""); try {
    const data = await studentRequest<{ records: Attempt[]; nextCursor: string | null }>(`/api/student/practice/attempts?page=1${next ? `&cursor=${encodeURIComponent(next)}` : ""}`);
    setAttempts(old => next ? [...(old ?? []), ...data.records] : data.records); setCursor(data.nextCursor);
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  useEffect(() => { void load(); }, []);
  return <main className="journey-shell"><h1>Practice history</h1><Link href="/practice">Back to practice</Link>
    {error && <p role="alert" className="journey-error">{error}<button disabled={busy} onClick={() => void load(cursor ?? undefined)}>Retry</button></p>}
    {!attempts ? <p role="status">{error ? "History unavailable" : "Loading attempts..."}</p> : attempts.length ? <ul className="journey-task-list">{attempts.map((a) => <li key={a.id}><div><strong>{a.questionText}</strong><span>{new Date(a.submittedAt).toLocaleString()} / {a.correct ? "Correct" : "Review needed"} / {a.score} of {a.maximumScore}</span>{a.explanation && <p>{a.explanation}</p>}</div><Link href={`/practice/questions/${a.questionId}`}>Retry</Link></li>)}</ul> : <p>No submitted answers yet.</p>}
    {cursor && <button disabled={busy} onClick={() => void load(cursor)}>Load earlier attempts</button>}
  </main>;
}
