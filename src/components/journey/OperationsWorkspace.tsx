"use client";
import { useEffect, useState } from "react";
import { studentRequest } from "./client";
import { ExamEditor } from "./ExamEditor";
type Row = { id: string; name?: string; title?: string; text?: string; questionId?: string; examId?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; active: boolean; reviewStatus?: "NEEDS_REVIEW" | "REVIEWED";
  scoringMode?: "EXACT_SET" | "DECIMAL_EXACT" | null; marks?: string; negativeMarks?: string;
  numericalAnswer?: string | null; options?: { id: string; text: string; isCorrect: boolean }[]; url?: string | null; reference?: string | null };
type Help = { id: string; subject: string; message: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED"; response: string | null; version: number };
const entities = ["EXAM", "SUBJECT", "CHAPTER", "LESSON", "RESOURCE", "QUESTION", "QUESTION_EXAM"];
export function OperationsWorkspace() {
  const [entity, setEntity] = useState("EXAM"); const [rows, setRows] = useState<Row[]>([]);
  const [queue, setQueue] = useState<Help[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("content");
  useEffect(() => { let active = true; setBusy(true); setError("");
    Promise.all([studentRequest<Row[]>(`/api/admin/publication?entity=${entity}`), studentRequest<Help[]>("/api/admin/help")])
      .then(([data, requests]) => { if (active) { setRows(data); setQueue(requests); } }).catch((e: Error) => active && setError(e.message)).finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [entity]);
  async function save(row: Row) {
    setBusy(true); setError("");
    try { await studentRequest("/api/admin/publication", "PATCH", { entity, id: row.id, status: row.status, active: row.active,
      ...(row.reviewStatus ? { reviewStatus: row.reviewStatus } : {}), ...(row.scoringMode ? { scoringMode: row.scoringMode } : {}) });
      setRows(await studentRequest<Row[]>(`/api/admin/publication?entity=${entity}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to publish"); } finally { setBusy(false); }
  }
  async function reply(help: Help) {
    setBusy(true); setError("");
    try { await studentRequest("/api/admin/help", "PATCH", { id: help.id, version: help.version, status: help.status, response: help.response });
      setQueue(await studentRequest<Help[]>("/api/admin/help")); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to respond"); } finally { setBusy(false); }
  }
  async function reloadSupport() {
    if (!window.confirm("Reload the queue and discard unsaved response edits?")) return;
    setBusy(true); setError("");
    try { setQueue(await studentRequest<Help[]>("/api/admin/help")); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to reload requests"); } finally { setBusy(false); }
  }
  function update(id: string, values: Partial<Row>) { setRows((records) => records.map((row) => row.id === id ? { ...row, ...values } : row)); }
  return <main className="journey-shell"><span className="journey-kicker">TOPRANK AI / OPERATIONS</span><h1>Operations</h1>
    <a href="/admin/accounts">Account operations</a>
    <a href="/admin/content">Content &amp; Knowledge Studio</a>
    <a href="/admin/content">Learning content</a>
    <div role="tablist" className="journey-actions"><button role="tab" aria-selected={tab === "content"} onClick={() => setTab("content")}>Publication</button><button role="tab" aria-selected={tab === "help"} onClick={() => setTab("help")}>Support queue</button></div>
    {error && <p className="journey-error" role="alert">{error}</p>}{busy && <p role="status">Loading or saving...</p>}
    {tab === "content" && entity === "EXAM" && <ExamEditor saved={() => void studentRequest<Row[]>("/api/admin/publication?entity=EXAM").then(setRows).catch((e: Error) => setError(e.message))} />}
    {tab === "content" ? <section><label className="journey-field">Content type<select disabled={busy} value={entity} onChange={(e) => setEntity(e.target.value)}>{entities.map((e) => <option key={e}>{e}</option>)}</select></label><ul className="journey-task-list">{rows.map((row) => <li key={row.id}><div><strong>{row.name ?? row.title ?? row.text ?? `${row.questionId} / ${row.examId}`}</strong><span>{row.id}</span>{row.marks && <p>Marks {row.marks} / Penalty {row.negativeMarks}</p>}{row.numericalAnswer && <p>Protected numerical answer: {row.numericalAnswer}</p>}{row.options?.map((option) => <p key={option.id}>{option.isCorrect ? "Correct: " : ""}{option.text}</p>)}{row.url && <p>{row.url}</p>}{row.reference && <p>{row.reference}</p>}</div><div className="journey-task-actions"><label>Status<select value={row.status} disabled={busy} onChange={(e) => update(row.id, { status: e.target.value as Row["status"] })}><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></label><label className="journey-check"><input type="checkbox" checked={row.active} disabled={busy} onChange={(e) => update(row.id, { active: e.target.checked })} />Active</label>{row.reviewStatus && <label>Review<select value={row.reviewStatus} disabled={busy} onChange={(e) => update(row.id, { reviewStatus: e.target.value as Row["reviewStatus"] })}><option>NEEDS_REVIEW</option><option>REVIEWED</option></select></label>}{entity === "QUESTION_EXAM" && <label>Scoring<select value={row.scoringMode ?? ""} disabled={busy} onChange={(e) => update(row.id, { scoringMode: e.target.value as Row["scoringMode"] })}><option value="" disabled>Not configured</option><option>EXACT_SET</option><option>DECIMAL_EXACT</option></select></label>}<button disabled={busy} onClick={() => void save(row)}>Save publication</button></div></li>)}</ul>{!busy && !rows.length && <p>No records available.</p>}</section> : <section><h2>Student requests</h2><button disabled={busy} onClick={() => void reloadSupport()}>Reload queue</button><ul className="journey-task-list">{queue.map((help) => <li key={help.id}><div><strong>{help.subject}</strong><p>{help.message}</p><label className="journey-field">Response<textarea rows={3} maxLength={2000} disabled={busy} value={help.response ?? ""} onChange={(e) => setQueue((data) => data.map((item) => item.id === help.id ? { ...item, response: e.target.value } : item))} /></label></div><div className="journey-task-actions"><label>Status<select disabled={busy} value={help.status} onChange={(e) => setQueue((data) => data.map((item) => item.id === help.id ? { ...item, status: e.target.value as Help["status"] } : item))}><option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option></select></label><button disabled={busy || !help.response?.trim()} onClick={() => void reply(help)}>Save response</button></div></li>)}</ul>{!queue.length && !busy && <p>No support requests yet.</p>}</section>}
  </main>;
}
