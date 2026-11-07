"use client";
import { useEffect, useState } from "react";
import { StudentRequestError, studentRequest } from "@/components/journey/client";

type RequestRow = { id: string; requesterId?: string; subjectId: string; kind: string; message: string; followUp: string | null;
  status: string; response: string | null; version: number; createdAt: string };
type Page = { records: RequestRow[]; page: number; hasNext: boolean; processingEnabled?: boolean };
type Pending = { requestKey: string; kind: string; message: string; subjectId?: string };
export function PrivacyRequests({ operator = false, guardian = false }: { operator?: boolean; guardian?: boolean }) {
  const endpoint = operator ? "/api/admin/privacy-requests" : "/api/account/privacy-requests";
  const [page, setPage] = useState(1); const [data, setData] = useState<Page | null>(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingReplies, setPendingReplies] = useState<Record<string, { requestKey: string; message: string; expectedVersion: number }>>({});
  async function reload() { setData(await studentRequest<Page>(endpoint + "?page=" + page)); }
  useEffect(() => { let active = true; setBusy(true); setError("");
    studentRequest<Page>(endpoint + "?page=" + page).then(row => active && setData(row))
      .catch(e => active && setError(e instanceof Error ? e.message : "Requests unavailable"))
      .finally(() => active && setBusy(false)); return () => { active = false; };
  }, [endpoint, page]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    if (!pending && values.get("kind") === "DELETE" && !window.confirm("Request manual account deletion? Submission does not immediately erase records.")) return;
    const subject = String(values.get("subjectId") ?? "").trim();
    const payload = pending ?? { requestKey: crypto.randomUUID(), kind: String(values.get("kind")), message: String(values.get("message")), ...(subject ? { subjectId: subject } : {}) };
    setPending(payload); setBusy(true); setError("");
    try { await studentRequest(endpoint, "POST", payload); setPending(null); form.reset(); await reload(); }
    catch (e) { if (e instanceof StudentRequestError && e.status < 500 && ![409, 429].includes(e.status)) setPending(null); setError(e instanceof Error ? e.message : "Request submission unavailable"); } finally { setBusy(false); }
  }
  async function respond(event: React.FormEvent<HTMLFormElement>, row: RequestRow) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setBusy(true); setError("");
    try {
      if (operator) await studentRequest(endpoint, "PATCH", { id: row.id, expectedVersion: row.version, status: values.get("status"), response: values.get("response"),
        ...(values.get("reference") ? { completionReference: values.get("reference") } : {}), processingVerified: values.get("verified") === "on" });
      else {
        const reply = pendingReplies[row.id] ?? { requestKey: crypto.randomUUID(), message: String(values.get("message")), expectedVersion: row.version };
        setPendingReplies(current => ({ ...current, [row.id]: reply }));
        await studentRequest(endpoint, "PATCH", { id: row.id, ...reply });
        setPendingReplies(current => { const next = { ...current }; delete next[row.id]; return next; });
      }
      form.reset(); await reload();
    } catch (e) {
      if (!operator && e instanceof StudentRequestError && e.status < 500 && e.status !== 429) setPendingReplies(current => { const next = { ...current }; delete next[row.id]; return next; });
      if (e instanceof StudentRequestError && e.status === 409) { try { await reload(); } catch { /* Retain the original conflict response. */ } }
      setError(e instanceof Error ? e.message : "Response unavailable");
    } finally { setBusy(false); }
  }
  return <main className="journey-shell"><h1>{operator ? "Account privacy queue" : "Account support & privacy"}</h1>
    <nav className="mock-links"><a href={operator ? "/admin/accounts" : "/account/consent"}>{operator ? "Account operations" : "Account consent"}</a><a href="/privacy">Privacy Notice</a><a href="/workspace">Workspace</a></nav>
    <p>Deletion, access and correction requests are reviewed by an authorized operator. Submitting a request does not immediately erase or export account records.</p>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">Please wait...</p>}
    {!operator && <section><h2>New request</h2><form className="commerce-form" onSubmit={create}>
      <label>Request<select name="kind" disabled={busy || !!pending}><option value="ACCOUNT_SUPPORT">Account support</option><option value="ACCESS">Access to my data</option><option value="CORRECT">Correct my data</option><option value="DELETE">Delete my account data</option></select></label>
      {guardian && <label>Student account ID (leave blank for your own account)<input name="subjectId" maxLength={100} disabled={busy || !!pending} /></label>}
      <label>Request details<textarea name="message" rows={4} minLength={10} maxLength={1000} required disabled={busy || !!pending} /></label>
      <p>Do not include passwords, authorization codes, payment details or identity documents.</p>
      <button className="button button-primary" disabled={busy}>{pending ? "Retry request" : "Submit request"}</button>
      {pending && <button className="button button-secondary" type="button" disabled={busy} onClick={event => { if (window.confirm("Discard this local draft? Any request already received by the server remains recorded.")) { setPending(null); event.currentTarget.form?.reset(); } }}>Discard local draft</button>}
    </form></section>}
    <section><h2>{operator ? "Requests" : "Your requests"}</h2>{operator && data && !data.processingEnabled && <p role="status">Privacy closure is disabled pending policy and processing approval. Account-support responses and review remain available.</p>}<button className="button button-secondary" disabled={busy} onClick={() => { setBusy(true); void reload().catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); }}>Refresh</button>
      {!busy && data && !data.records.length && <p>No requests recorded.</p>}
      <ul className="journey-task-list">{data?.records.map(row => <li key={row.id} style={{ display: "block", overflowWrap: "anywhere" }}>
        <h3>{row.kind.replace(/_/g, " ")} / {row.status.replace(/_/g, " ")}</h3><p>{row.id}</p>
        {operator && <p>Requester: {row.requesterId} / Subject: {row.subjectId}</p>}<p>{row.message}</p>
        {row.followUp && <p>Latest follow-up: {row.followUp}</p>}{row.response && <p>Operator response: {row.response}</p>}
        {!["RESOLVED", "REJECTED"].includes(row.status) && <form className="commerce-form" onSubmit={event => void respond(event, row)}>
          {operator ? <><label>Decision<select name="status" disabled={busy}>{(row.status === "OPEN" ? ["IN_REVIEW", "AWAITING_USER", "REJECTED"] : row.status === "IN_REVIEW" ? ["AWAITING_USER", "RESOLVED", "REJECTED"] : ["IN_REVIEW", "RESOLVED", "REJECTED"]).map(status => <option key={status} disabled={row.kind !== "ACCOUNT_SUPPORT" && ["RESOLVED", "REJECTED"].includes(status) && !data.processingEnabled}>{status}</option>)}</select></label>
            <label>Response<textarea name="response" rows={3} minLength={10} maxLength={1000} required disabled={busy} /></label>
            <label>Restricted processing evidence reference (required to close)<input name="reference" minLength={8} maxLength={200} disabled={busy} /></label>
            <label><input name="verified" type="checkbox" disabled={busy} /> Required identity/authority checks and manual processing outcome verified.</label>
          </> : <label>Follow-up<textarea name="message" minLength={10} maxLength={1000} rows={3} required disabled={busy || !!pendingReplies[row.id]} /></label>}
          <button className="button button-secondary" disabled={busy}>{operator ? "Record decision" : pendingReplies[row.id] ? "Retry follow-up" : "Send follow-up"}</button>
          {!operator && pendingReplies[row.id] && <button className="button button-secondary" type="button" disabled={busy} onClick={() => { if (window.confirm("Discard this local follow-up? Server records are unchanged.")) setPendingReplies(current => { const next = { ...current }; delete next[row.id]; return next; }); }}>Discard local follow-up</button>}
        </form>}
      </li>)}</ul>
      <div className="journey-actions"><button disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button disabled={busy || !data?.hasNext} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </section></main>;
}
