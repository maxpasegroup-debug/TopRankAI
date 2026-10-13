"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { studentRequest } from "./client";
import { NotificationInbox } from "./NotificationInbox";
type Help = { id: string; subject: string; message: string; status: string; response: string | null };
type Guidance = { suggestion: string; href: string; source: string };
export function GetHelp() {
  const [requests, setRequests] = useState<Help[]>([]);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [key, setKey] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [reload, setReload] = useState(0);
  useEffect(() => { let active = true;
    setLoading(true); setError("");
    studentRequest<Help[]>("/api/student/help").then(help => { if (active) setRequests(help); }).catch((e: Error) => active && setError(e.message)).finally(() => active && setLoading(false));
    studentRequest<Guidance>("/api/student/sia").then(sia => { if (active) setGuidance(sia); }).catch(() => { if (active) setGuidance(null); });
    return () => { active = false; };
  }, [reload]);
  async function send() {
    const requestKey = key || crypto.randomUUID(); setKey(requestKey); setBusy(true); setError("");
    try { await studentRequest("/api/student/help", "POST", { requestKey, subject, message });
      setRequests(await studentRequest<Help[]>("/api/student/help")); setSubject(""); setMessage(""); setKey(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to send request"); } finally { setBusy(false); }
  }
  return <main className="journey-shell"><span className="journey-kicker">SIA / STUDENT SUPPORT</span><h1>Get Help</h1>
    {error && <p role="alert" className="journey-error">{error}</p>}{loading && <p role="status">Loading support...</p>}
    {guidance && <section><h2>Your next step</h2><p>{guidance.suggestion}</p><Link href={guidance.href}>Continue preparation</Link></section>}
    <section><h2>Ask for help</h2><div className="journey-fields"><label className="journey-field">Subject<input maxLength={120} disabled={busy} value={subject} onChange={(e) => { setSubject(e.target.value); setKey(""); }} /></label><label className="journey-field">Your question<textarea rows={5} maxLength={2000} disabled={busy} value={message} onChange={(e) => { setMessage(e.target.value); setKey(""); }} /></label></div><div className="journey-actions"><button className="journey-primary" disabled={busy || subject.trim().length < 3 || message.trim().length < 10} onClick={() => void send()}>{busy ? "Saving..." : "Send request"}</button></div></section>
    <section><h2>Your requests</h2><button disabled={busy || loading} onClick={() => setReload(n => n + 1)}>Refresh requests</button>{requests.length ? <ul className="journey-task-list">{requests.map((r) => <li key={r.id}><div><strong>{r.subject}</strong><span>{r.status.split("_").join(" ")}</span><p>{r.message}</p>{r.response && <p>{r.response}</p>}</div></li>)}</ul> : !loading && <p>No help requests yet.</p>}</section>
    <NotificationInbox />
    <section><h2>TeachX Guru</h2><p>Teacher discovery and bookings are currently unavailable.</p></section>
  </main>;
}
