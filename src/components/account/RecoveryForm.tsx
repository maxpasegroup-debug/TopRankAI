"use client";
import { useEffect, useState } from "react";
import { Brand } from "@/components/layout/Brand";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState(""); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    if (reset) {
      setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [reset]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    if (reset && data.get("password") !== data.get("confirmation")) { setError("Passwords do not match"); setBusy(false); return; }
    try {
      const response = await fetch(reset ? "/api/auth/reset-password" : "/api/auth/recovery", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(reset ? { token, password: data.get("password") } : { email: data.get("email") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "Account recovery is unavailable");
      setMessage(reset ? "Password updated. Sign in with your new password." : result.data.message);
      if (reset) setToken("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to connect"); }
    finally { setBusy(false); }
  }
  return <main className="auth-container"><section className="auth-panel compact-auth"><form className="auth-form" onSubmit={submit}>
    <Brand /><h1 className="section-title">{reset ? "Set a new password" : "Recover your account"}</h1>
    {!reset ? <label>Email<input className="input" name="email" type="email" autoComplete="email" required /></label> : <>
      {!token && !message && <p role="alert">Recovery link is missing. Request a new link.</p>}
      <label>New password<input className="input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
      <label>Confirm password<input className="input" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
    </>}
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="button button-primary" disabled={busy || reset && !token}>{busy ? "Please wait..." : reset ? "Update password" : "Request recovery"}</button>
    <a href="/login">Back to login</a>
  </form></section></main>;
}
