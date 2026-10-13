"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { studentRequest } from "@/components/journey/client";
type Row = { id: string; title: string; type: string; url: string | null; reference: string | null; href: string };
type Page = { records: Row[]; nextCursor: string | null };
export function ResourceSaveButton({ resourceId }: { resourceId: string }) {
  const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true;
    studentRequest<{ saved: boolean }>(`/api/student/saved-resources?resourceId=${encodeURIComponent(resourceId)}`).then(data => active && setSaved(data.saved))
      .catch((e: Error) => active && setError(e.message)).finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [resourceId]);
  async function toggle() { setBusy(true); setError("");
    try { const data = await studentRequest<{ saved: boolean }>("/api/student/saved-resources", "PUT", { resourceId, saved: !saved }); setSaved(data.saved); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save resource"); } finally { setBusy(false); }
  }
  return <div><button disabled={busy} aria-pressed={saved} onClick={() => void toggle()}>{saved ? "Unsave resource" : "Save resource"}</button>{error && <p role="alert">{error}</p>}</div>;
}
export function SavedResources() {
  const [page, setPage] = useState<Page | null>(null); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true; studentRequest<Page>("/api/student/saved-resources").then(value => active && setPage(value))
    .catch((e: Error) => active && setError(e.message)).finally(() => active && setBusy(false)); return () => { active = false; }; }, []);
  async function more() { if (!page?.nextCursor) return; setBusy(true); setError("");
    try { const next = await studentRequest<Page>(`/api/student/saved-resources?cursor=${encodeURIComponent(page.nextCursor)}`); setPage({ records: [...page.records, ...next.records], nextCursor: next.nextCursor }); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load resources"); } finally { setBusy(false); }
  }
  async function remove(id: string) { setBusy(true); setError(""); try { await studentRequest("/api/student/saved-resources", "PUT", { resourceId: id, saved: false }); setPage(old => old ? { ...old, records: old.records.filter(row => row.id !== id) } : old); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to remove resource"); } finally { setBusy(false); } }
  return <main className="journey-shell"><nav><Link href="/learn">Learning</Link></nav><h1>Saved resources</h1>
    {error && <p className="journey-error" role="alert">{error}</p>}{busy && <p role="status">Loading...</p>}
    <ul className="journey-task-list">{page?.records.map(row => <li key={row.id}><div><strong>{row.title}</strong><span>{row.type}</span>{row.reference && <p>{row.reference}</p>}<Link href={row.href}>Open lesson</Link></div><div className="journey-actions">{row.url && <a href={row.url} target="_blank" rel="noopener noreferrer">Open resource</a>}<button disabled={busy} onClick={() => void remove(row.id)}>Unsave</button></div></li>)}</ul>
    {page && !page.records.length && !busy && <p>No saved resources.</p>}{page?.nextCursor && <button disabled={busy} onClick={() => void more()}>Load more</button>}
  </main>;
}
