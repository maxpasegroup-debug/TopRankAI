"use client";
import { useEffect, useState } from "react";
import { studentRequest } from "@/components/journey/client";
type Grant = { id: string; country: string; verifiedAt: string; usedAt: string | null; revokedAt: string | null; expiresAt: string };
export function GuardianConsent() {
  const [rows, setRows] = useState<Grant[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  async function load() { setRows(await studentRequest<Grant[]>("/api/account/guardian-consent")); }
  useEffect(() => { let active = true; studentRequest<Grant[]>("/api/account/guardian-consent").then(data => active && setRows(data)).catch(e => active && setError(e instanceof Error ? e.message : "Unavailable")).finally(() => active && setBusy(false)); return () => { active = false; }; }, []);
  async function revoke(id: string) {
    if (!window.confirm("Withdraw this registration authorization? The student's account sessions will end.")) return;
    setBusy(true); setError(""); try { await studentRequest("/api/account/guardian-consent", "POST", { grantId: id }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unavailable"); } finally { setBusy(false); }
  }
  return <main className="journey-shell"><h1>Registration authorizations</h1><a href="/parent">Guardian workspace</a>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">Please wait...</p>}
    {!busy && !rows.length && <p>No registration authorizations recorded.</p>}
    <ul className="journey-task-list">{rows.map(row => <li key={row.id}><div><strong>{row.country} / {new Date(row.verifiedAt).toLocaleDateString()}</strong><span>{row.id}</span><span>{row.revokedAt ? "Withdrawn" : row.usedAt ? "Registered" : "Awaiting registration"}</span></div>
      <button className="button button-secondary" disabled={busy || !!row.revokedAt} onClick={() => void revoke(row.id)}>Withdraw authorization</button></li>)}</ul>
  </main>;
}
