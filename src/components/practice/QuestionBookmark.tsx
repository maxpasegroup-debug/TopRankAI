"use client";
import { useEffect, useState } from "react";
import { studentRequest } from "@/components/journey/client";
export function QuestionBookmark({ questionId }: { questionId: string }) {
  const [saved, setSaved] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { let active = true; studentRequest<{ bookmarked: boolean }>(`/api/student/practice/revision?questionId=${encodeURIComponent(questionId)}`).then(d => { if (active) { setSaved(d.bookmarked); setReady(true); } }).catch((e: Error) => active && setError(e.message)); return () => { active = false; }; }, [questionId]);
  async function change() { setBusy(true); setError(""); try { await studentRequest("/api/student/practice/revision", "POST", { questionId, action: "BOOKMARK", bookmarked: !saved }); setSaved(!saved); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div><label className="journey-check"><input type="checkbox" checked={saved} disabled={!ready || busy} onChange={() => void change()} />Bookmark question</label>{error && <p role="alert">{error}</p>}</div>;
}
