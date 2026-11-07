"use client";
import { useEffect, useState } from "react";
import { ACCOUNT_POLICY_VERSION, needsGuardian, type AccountAgeBand } from "@/shared/account-policy";
import { studentRequest } from "@/components/journey/client";

export function AccountConsent({ accountRole = "STUDENT" }: { accountRole?: "STUDENT" | "PARENT" }) {
  const [country, setCountry] = useState(""); const [ageBand, setAgeBand] = useState<AccountAgeBand | "">(accountRole === "PARENT" ? "18_PLUS" : "");
  const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [accepted, setAccepted] = useState(false);
  useEffect(() => { let active = true;
    studentRequest<{ country: string; ageBand: AccountAgeBand; current: boolean } | null>("/api/account/consent")
      .then(data => { if (active && data) { setCountry(data.country); setAgeBand(data.ageBand); setAccepted(data.current); } })
      .catch(e => active && setError(e instanceof Error ? e.message : "Consent unavailable"))
      .finally(() => active && setBusy(false)); return () => { active = false; };
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try { await studentRequest("/api/account/consent", "POST", { country, ageBand, termsAccepted: data.get("termsAccepted") === "on", privacyAccepted: data.get("privacyAccepted") === "on",
      termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION, ...(ageBand && needsGuardian(ageBand) ? { guardianApproval: data.get("guardianApproval") } : {}) });
      window.location.href = "/workspace";
    } catch (e) { setError(e instanceof Error ? e.message : "Consent unavailable"); } finally { setBusy(false); }
  }
  async function withdraw() {
    if (!window.confirm(accountRole === "PARENT" ? "Withdraw your consent and linked registration authorizations? Linked students will need new authorization. Optional sharing and sessions will end." : "Withdraw account consent? All sessions, optional sharing and public achievement links will end.")) return;
    setBusy(true); setError("");
    try { await studentRequest("/api/account/consent", "DELETE"); window.location.href = "/login"; }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to withdraw"); } finally { setBusy(false); }
  }
  return <main className="journey-shell"><h1>Account consent</h1><nav className="mock-links"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/account/privacy-requests">Account support &amp; privacy</a><a href="/workspace">Workspace</a></nav>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">Please wait...</p>}
    {accepted ? <><p>Current policies accepted.</p><button className="button button-secondary" disabled={busy} onClick={() => void withdraw()}>Withdraw consent</button></> : <form className="commerce-form" onSubmit={save}>
      <label>Country<select required value={country} onChange={e => setCountry(e.target.value)}><option value="">Select country</option><option value="IN">India</option><option value="AE">United Arab Emirates</option></select></label>
      {accountRole === "PARENT" ? <p>Guardian accounts require verified adulthood.</p> : <label>Age group<select required value={ageBand} onChange={e => setAgeBand(e.target.value as AccountAgeBand)}><option value="">Select age group</option><option value="UNDER_13">Under 13</option><option value="13_TO_17">13 to 17</option><option value="18_PLUS">18 or older</option></select></label>}
      {ageBand && needsGuardian(ageBand) && <label>Guardian authorization code<input name="guardianApproval" type="password" autoComplete="off" minLength={43} maxLength={43} required /></label>}
      <label><input type="checkbox" name="termsAccepted" required /> I accept the Terms.</label><label><input type="checkbox" name="privacyAccepted" required /> I have read and accept the Privacy Notice.</label>
      <button className="button button-primary" disabled={busy}>Accept and continue</button>
    </form>}<form action="/api/auth/logout" method="post"><button className="button button-secondary">Sign out</button></form>
  </main>;
}
