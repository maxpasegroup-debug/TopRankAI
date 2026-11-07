"use client";
import { useState } from "react";
import { studentRequest } from "@/components/journey/client";
import { Icon } from "@/components/ui/Icon";
export function AdminAccounts() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [token, setToken] = useState(""); const [message, setMessage] = useState("");
  async function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setToken(""); const form = event.currentTarget; const data = new FormData(form);
    try { const result = await studentRequest<{ approval: string }>("/api/admin/accounts", "POST", { action: "guardianApproval", guardianId: data.get("guardianId"), childEmail: data.get("childEmail"), country: data.get("country"), verificationReference: data.get("verificationReference"), guardianIdentityAndAuthorityVerified: data.get("verified") === "on", guardianConsentRecorded: data.get("consented") === "on" }); setToken(result.approval); form.reset(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to issue"); } finally { setBusy(false); }
  }
  async function deliver() { setBusy(true); setError(""); setMessage(""); try { const result = await studentRequest<{ accepted: number }>("/api/admin/accounts", "POST", { action: "deliverRecovery", limit: 5 }); setMessage(result.accepted + " recovery messages accepted by the provider."); } catch (e) { setError(e instanceof Error ? e.message : "Delivery unavailable"); } finally { setBusy(false); } }
  async function clearExpired() { setBusy(true); setError(""); setMessage(""); try { const result = await studentRequest<{ cleared: number }>("/api/admin/accounts", "POST", { action: "clearRecoveryPayloads", limit: 100 }); setMessage(result.cleared + " expired or consumed recovery payloads cleared."); } catch (e) { setError(e instanceof Error ? e.message : "Cleanup unavailable"); } finally { setBusy(false); } }
  async function verifyAdult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); const form = event.currentTarget; const data = new FormData(form);
    try { await studentRequest("/api/admin/accounts", "POST", { action: "verifyAdult", studentId: data.get("studentId"), verificationReference: data.get("verificationReference"), adultIdentityVerified: data.get("verified") === "on" }); form.reset(); setMessage("Age verification recorded. Renewed account consent is required."); }
    catch (e) { setError(e instanceof Error ? e.message : "Verification unavailable"); } finally { setBusy(false); }
  }
  return <main className="journey-shell"><h1>Account operations</h1><nav className="mock-links"><a href="/admin">Operations workspace</a><a href="/admin/privacy-requests">Account privacy queue</a></nav>{error && <p role="alert">{error}</p>}
    <section><h2>Verified guardian authorization</h2><form className="commerce-form" onSubmit={issue}>
      <label>Verified guardian account ID<input name="guardianId" maxLength={100} required /></label><label>Authorized student email<input name="childEmail" type="email" autoComplete="off" required /></label>
      <label>Country<select name="country"><option value="IN">India</option><option value="AE">United Arab Emirates</option></select></label>
      <label>Verification evidence reference<input name="verificationReference" minLength={8} maxLength={200} required /></label>
      <label><input name="verified" type="checkbox" required /> Guardian adulthood, identity and authority verified.</label>
      <label><input name="consented" type="checkbox" required /> Guardian registration consent recorded for the current policies.</label>
      <button className="button button-primary" disabled={busy}>Issue single-use authorization</button>
    </form>{token && <div><label>Authorization code<input type="password" readOnly value={token} autoComplete="off" /></label><button className="button button-secondary" title="Copy authorization code" aria-label="Copy authorization code" onClick={() => void navigator.clipboard.writeText(token)}><Icon name="check" /></button><button className="button button-secondary" onClick={() => setToken("")}>Dismiss</button></div>}</section>
    <section><h2>Verified adulthood update</h2><form className="commerce-form" onSubmit={verifyAdult}>
      <label>Student account ID<input name="studentId" maxLength={100} required /></label><label>Verification evidence reference<input name="verificationReference" minLength={8} maxLength={200} required /></label>
      <label><input name="verified" type="checkbox" required /> Student identity and adulthood verified.</label><button className="button button-secondary" disabled={busy}>Record verification</button>
    </form></section>
    <section><h2>Queued recovery delivery</h2><button className="button button-secondary" disabled={busy} onClick={() => void deliver()}>Process five queued messages</button><button className="button button-secondary" disabled={busy} onClick={() => void clearExpired()}>Clear expired recovery payloads</button>{message && <p role="status">{message}</p>}</section>
  </main>;
}
