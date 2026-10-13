"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { studentRequest } from "@/components/journey/client";
type Data = { truncated: boolean; entries: { questionId: string; text: string; attemptId: string | null; explanation: string | null;
  bookmarked: boolean; incorrect: boolean; reviewed: boolean; available: boolean; lessonHref: string | null }[] };
export function PracticeRevision() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [filter, setFilter] = useState("Pending");
  async function load() { setError(""); setData(await studentRequest<Data>("/api/student/practice/revision")); }
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, []);
  async function act(input: unknown) { setBusy(true); setError(""); try { await studentRequest("/api/student/practice/revision", "POST", input); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <section className="journey-shell"><h1>Mistake-to-Mastery</h1><nav className="mock-links"><Link href="/practice">Practice</Link><Link href="/practice/review">Attempt history</Link><Link href="/home">Study command centre</Link></nav>
    {error && <p role="alert" className="journey-error">{error}<button disabled={busy} onClick={() => void load().catch((e: Error) => setError(e.message))}>Retry</button></p>}
    <label className="journey-field">Practice review queue<select value={filter} onChange={e => setFilter(e.target.value)}>{["Pending", "Mistakes", "Bookmarks", "All"].map(f => <option key={f}>{f}</option>)}</select></label>
    {data?.truncated && <p role="status">Showing the latest 100 attempted questions and up to 200 saved review records.</p>}
    {!data ? <p role="status">{error ? "Practice revision unavailable" : "Loading practice revision..."}</p> : <ul className="journey-task-list">{data.entries.filter(e => filter === "All" || (filter === "Bookmarks" ? e.bookmarked : filter === "Mistakes" ? e.incorrect : e.incorrect && !e.reviewed)).map(e => <li key={e.questionId}><div><strong>{e.text}</strong><span>{e.incorrect ? "Latest attempt incorrect" : "Saved question"}{e.reviewed ? " / Reviewed" : ""}</span>{e.explanation && <p>{e.explanation}</p>}
      {!e.available && <p>Question unavailable for your current exam.</p>}<div className="mock-links">{e.available && <Link href={`/practice/questions/${e.questionId}`}>Focused retry</Link>}{e.lessonHref && <Link href={e.lessonHref}>Review lesson</Link>}
      <button disabled={busy} onClick={() => void act({ questionId: e.questionId, action: "BOOKMARK", bookmarked: !e.bookmarked })}>{e.bookmarked ? "Remove bookmark" : "Bookmark"}</button>
      {e.attemptId && <button disabled={busy || e.reviewed} onClick={() => void act({ questionId: e.questionId, action: "REVIEW", attemptId: e.attemptId })}>Mark reviewed</button>}</div></div></li>)}</ul>}
    {data && !data.entries.length && <p>No practice mistakes or bookmarks yet.</p>}
  </section>;
}
