"use client";

import { useState } from "react";
import { ACCOUNT_POLICY_VERSION, needsGuardian, type AccountAgeBand } from "@/shared/account-policy";
import { Brand } from "../components/layout/Brand";
import { Button } from "../components/ui/Button";

type AuthPageProps = {
  mode: "login" | "signup";
};

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login";
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ageBand, setAgeBand] = useState<AccountAgeBand | "">("");
  const [country, setCountry] = useState("");
  const [guardianApproval, setGuardianApproval] = useState("");
  const [detailsReady, setDetailsReady] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    if (!isLogin && !detailsReady) {
      try {
        if (ageBand && needsGuardian(ageBand)) {
          const checked = await fetch("/api/auth/guardian-consent/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ country, approval: guardianApproval }) });
          const result = await checked.json();
          if (!checked.ok) { setError(result?.error?.message ?? "Guardian authorization is unavailable"); return; }
        }
        setDetailsReady(true);
      } catch { setError("Unable to connect. Please try again."); }
      finally { setIsSubmitting(false); }
      return;
    }
    const payload = isLogin ? Object.fromEntries(formData.entries()) : {
      name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), country, ageBand,
      termsAccepted: formData.get("termsAccepted") === "on", privacyAccepted: formData.get("privacyAccepted") === "on",
      termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION,
      ...(ageBand && needsGuardian(ageBand) ? { guardianApproval } : {}),
    };
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result?.error?.message ?? "Authentication failed");
        return;
      }

      window.location.href = isLogin ? "/workspace" : "/onboarding";
    } catch {
      setError("Unable to connect to TopRank. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-container">
      <section className="auth-panel compact-auth">
        <form className="auth-form" onSubmit={handleSubmit}>
          <Brand />
          <p className="eyebrow">{isLogin ? "Welcome Back" : "Start your journey"}</p>
          <h1 className="section-title">{isLogin ? "Welcome Back" : "Create your path"}</h1>
          <p className="section-subtitle">
            {isLogin ? "Your next study day starts here." : "A goal of your own. A fresh start."}
          </p>
          {!isLogin && !detailsReady && <>
            <label>Country<select className="input" value={country} onChange={e => setCountry(e.target.value)} required><option value="">Select country</option><option value="IN">India</option><option value="AE">United Arab Emirates</option></select></label>
            <label>Age group<select className="input" value={ageBand} onChange={e => { setAgeBand(e.target.value as AccountAgeBand); setGuardianApproval(""); }} required><option value="">Select age group</option><option value="UNDER_13">Under 13</option><option value="13_TO_17">13 to 17</option><option value="18_PLUS">18 or older</option></select></label>
            {ageBand && needsGuardian(ageBand) && <label>Guardian authorization code<input className="input" autoComplete="off" type="password" value={guardianApproval} onChange={e => setGuardianApproval(e.target.value)} minLength={43} maxLength={43} required /><a href="/guardian-registration">Guardian authorization</a></label>}
          </>}
          {(isLogin || detailsReady) && <>
            {!isLogin && <input className="input" name="name" placeholder="Name" aria-label="Name" autoComplete="name" maxLength={120} required />}
            <input className="input" name="email" placeholder="Email" aria-label="Email" type="email" autoComplete="email" required />
            <input className="input" name="password" placeholder="Password" aria-label="Password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={isLogin ? 1 : 8} maxLength={isLogin ? 128 : 72} />
            {!isLogin && <>
              <label><input name="termsAccepted" type="checkbox" required /> I accept the <a href="/terms" target="_blank" rel="noreferrer">Terms</a>.</label>
              <label><input name="privacyAccepted" type="checkbox" required /> I have read and accept the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.</label>
              <button type="button" className="button button-ghost" onClick={() => setDetailsReady(false)}>Change registration details</button>
            </>}
          </>}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : "Continue"}
          </button>
          {isLogin ? (
            <Button href="/workspace" variant="secondary">
              Open workspace
            </Button>
          ) : null}
          {isLogin && <Button href="/recover-account" variant="ghost">Forgot password?</Button>}
          <Button href={isLogin ? "/signup" : "/login"} variant="ghost">
            {isLogin ? "New student? Sign up" : "Already joined? Log in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
