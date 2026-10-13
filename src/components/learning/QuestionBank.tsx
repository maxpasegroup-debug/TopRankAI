"use client";
import { useEffect, useState } from "react";
import { studentRequest } from "@/components/journey/client";
import styles from "./ContentWorkspace.module.css";
type Row = { id: string; code: string; text: string; type: string; difficulty: string; status: string; reviewStatus: string; hasExplanation: boolean };
type Detail = { fingerprint: string; record: { text: string; explanation: string | null; numericalAnswer: string | null; options: { code: string; text: string; isCorrect: boolean }[];
  exams: { examId: string; marks: string; negativeMarks: string; scoringMode: string | null }[] } | null;
  source: { title: string; licence: string; rightsHolder: string; permissionEvidence: string; attribution: string } | null };
export function QuestionBank() {
  const [rows, setRows] = useState<Row[]>([]), [detail, setDetail] = useState<Detail | null>(null), [selected, setSelected] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [search, setSearch] = useState(""), [truncated, setTruncated] = useState(false);
  async function load() { const data = await studentRequest<{ records: Row[]; truncated: boolean }>("/api/admin/content/questions"); setRows(data.records); setTruncated(data.truncated); }
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, []);
  async function inspect(id: string) { setBusy(true); setError(""); setDetail(null); setSelected(id); try { setDetail(await studentRequest<Detail>(`/api/admin/content/questions?id=${encodeURIComponent(id)}`)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function send(input: unknown) { setBusy(true); setError(""); setMessage(""); try { await studentRequest("/api/admin/content/questions", "POST", input); await load(); setSelected(""); setDetail(null); setMessage("Question action recorded."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { const fields = Object.fromEntries(["code", "text", "type", "difficulty", "chapterId", "explanation", "language", "sourceTitle", "rightsHolder", "origin", "licence", "permissionEvidence", "attribution"].map(key => [key, form.get(key)]));
      void send({ action: "CREATE", ...fields, options: JSON.parse(String(form.get("options"))), exams: JSON.parse(String(form.get("exams"))),
        ...(form.get("supersedesId") ? { supersedesId: form.get("supersedesId") } : {}), ...(form.get("lessonId") ? { lessonId: form.get("lessonId") } : {}), ...(form.get("sourceUrl") ? { sourceUrl: form.get("sourceUrl") } : {}),
        ...(form.get("numericalAnswer") ? { numericalAnswer: form.get("numericalAnswer") } : {}) });
    } catch { setError("Options and exam scoring must be valid JSON"); }
  }
  return <section><h2>Question Bank</h2>{error && <p role="alert" className="journey-error">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="journey-actions"><label className="journey-field">Search<input type="search" maxLength={160} value={search} onChange={e => setSearch(e.target.value)} /></label><button disabled={busy} onClick={() => void load().catch((e: Error) => setError(e.message))}>Refresh</button></div>
    {truncated && <p role="status">Showing the first 100 questions.</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Question</th><th>Type</th><th>Status</th><th>Review</th><th>Explanation</th><th>Action</th></tr></thead><tbody>{rows.filter(r => `${r.code} ${r.text} ${r.type} ${r.status}`.toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id}><td>{row.code}<br />{row.text}</td><td>{row.type}</td><td>{row.status}</td><td>{row.reviewStatus}</td><td>{row.hasExplanation ? "Present" : "Missing"}</td><td><button disabled={busy} onClick={() => void inspect(row.id)}>Inspect</button></td></tr>)}</tbody></table></div>
    {!rows.length && <p>No questions.</p>}
    {detail?.record && <section><h3>{detail.record.text}</h3><p>{detail.record.explanation}</p><h4>Protected answer — administrator only</h4>{detail.record.numericalAnswer ? <p>{detail.record.numericalAnswer}</p> : <ul>{detail.record.options.map(o => <li key={o.code}>{o.code}. {o.text}{o.isCorrect ? " / Correct" : ""}</li>)}</ul>}
      <h4>Exam scoring</h4><ul>{detail.record.exams.map(e => <li key={e.examId}>{e.examId} / +{e.marks} / -{e.negativeMarks} / {e.scoringMode ?? "Not configured"}</li>)}</ul>
      <p>Source: {detail.source?.title ?? "Not recorded"}</p><p>Rights holder: {detail.source?.rightsHolder ?? "Not recorded"}</p><p>Licence: {detail.source?.licence ?? "Not recorded"}</p><p>Evidence: {detail.source?.permissionEvidence ?? "Not recorded"}</p><p>Attribution: {detail.source?.attribution}</p>
      <form className="commerce-form" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void send({ action: form.get("action"), id: selected, fingerprint: detail.fingerprint, evidence: form.get("evidence") }); }}>
        <label className="journey-field">Decision<select name="action" disabled={busy}><option value="REVIEW">Approve question, explanation and rights</option><option value="PUBLISH">Publish approved question</option><option value="ARCHIVE">Archive</option></select></label><label className="journey-field">Decision evidence<input name="evidence" minLength={8} maxLength={1000} required disabled={busy} /></label><button disabled={busy}>Record decision</button></form></section>}
    <form className="commerce-form" onSubmit={create}><h3>New immutable question draft</h3>
      {[["code", "Unique question code"], ["chapterId", "Chapter ID"], ["supersedesId", "Replaces question ID (optional)"], ["lessonId", "Lesson ID (optional)"], ["language", "Language"], ["sourceTitle", "Source title"], ["sourceUrl", "Source URL (optional)"], ["rightsHolder", "Rights holder"], ["licence", "Licence / permitted use"], ["permissionEvidence", "Permission evidence"], ["attribution", "Attribution"]].map(([name, label]) => <label className="journey-field" key={name}>{label}<input name={name} type={name === "sourceUrl" ? "url" : "text"} maxLength={1000} required={!["sourceUrl", "supersedesId", "lessonId", "attribution"].includes(name)} defaultValue={name === "language" ? "en" : undefined} disabled={busy} /></label>)}
      <label className="journey-field">Type<select name="type" disabled={busy}>{["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"].map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="journey-field">Difficulty<select name="difficulty" disabled={busy}>{["EASY", "MEDIUM", "HARD"].map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="journey-field">Origin<select name="origin" disabled={busy}>{["ORIGINAL", "LICENSED", "PUBLIC_REFERENCE", "AI_ASSISTED"].map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="journey-field">Question<textarea name="text" maxLength={5000} required disabled={busy} /></label><label className="journey-field">Explanation<textarea name="explanation" maxLength={5000} minLength={8} required disabled={busy} /></label>
      <label className="journey-field">Protected numerical answer<input name="numericalAnswer" inputMode="decimal" maxLength={60} disabled={busy} /></label>
      <label className="journey-field">Options JSON<textarea name="options" required maxLength={32000} rows={5} defaultValue="[]" placeholder={'[{"code":"A","text":"Option","isCorrect":true}]'} disabled={busy} /></label>
      <label className="journey-field">Exam scoring JSON<textarea name="exams" required maxLength={4000} rows={4} placeholder={'[{"examId":"existing-exam-id","marks":4,"negativeMarks":1}]'} disabled={busy} /></label><button disabled={busy}>Save draft</button>
    </form>
  </section>;
}
