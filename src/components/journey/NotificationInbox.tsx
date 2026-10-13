"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { studentRequest } from "./client";
import type { getInbox } from "@/server/notifications/service";
type Inbox = Awaited<ReturnType<typeof getInbox>>;
export function NotificationInbox() {
  const [data, setData] = useState<Inbox | null>(null), [error, setError] = useState("");
  const [page, setPage] = useState(1), [unread, setUnread] = useState(false), [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; setData(null); setError(""); studentRequest<Inbox>(`/api/student/notifications?page=${page}&unread=${unread}`).then(value => { if (active) setData(value); }).catch((e: Error) => { if (active) setError(e.message); }); return () => { active = false; }; }, [page, unread, refresh]);
  async function read(id?: string) { setBusy(true); setError(""); try { await studentRequest("/api/student/notifications", "POST", id ? { action: "READ", id } : { action: "READ_ALL" }); setPage(1); setRefresh(value => value + 1); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <section style={{ minWidth: 0, overflowWrap: "anywhere" }}><h2>Notifications{data ? ` / ${data.unread} unread` : ""}</h2>
    <div className="mock-links"><label><input type="checkbox" checked={unread} disabled={busy} onChange={e => { setUnread(e.target.checked); setPage(1); }} /> Unread only</label><button disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh</button><button disabled={busy || !data?.unread} onClick={() => void read()}>Mark all read</button></div>
    {error && <p role="alert" className="journey-error">{error}<button disabled={busy} onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
    {!data ? <p role="status">{error ? "Notifications unavailable" : "Loading notifications..."}</p> : data.entries.length ? <ul className="journey-task-list">{data.entries.map(entry => <li key={entry.id}><div><strong>{entry.message}</strong><span>{entry.read ? "Read" : "Unread"} / {new Date(entry.at).toLocaleDateString()}</span></div><div className="mock-links"><Link href={entry.href}>Open</Link>{!entry.read && <button disabled={busy} onClick={() => void read(entry.id)}>Mark read</button>}</div></li>)}</ul> : <p>No {unread ? "unread " : ""}notifications.</p>}
    <nav className="mock-links" aria-label="Notification pages"><button aria-label="Previous page" title="Previous page" disabled={busy || page === 1} onClick={() => setPage(value => value - 1)}>&larr;</button><span>Page {page}</span><button aria-label="Next page" title="Next page" disabled={busy || !data?.hasNext || page === 100} onClick={() => setPage(value => value + 1)}>&rarr;</button></nav>
  </section>;
}
