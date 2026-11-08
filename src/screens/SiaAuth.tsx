"use client";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/layout/Brand";
import { Icon } from "@/components/ui/Icon";
import { studentRequest } from "@/components/journey/client";
import { ACCOUNT_POLICY_VERSION, needsGuardian, type AccountAgeBand } from "@/shared/account-policy";
import styles from "./SiaAuth.module.css";

type Flow = "signup" | "login" | "reset" | "password";
type Step = "identity" | "email" | "consent" | "otp" | "pin" | "confirm" | "login" | "password" | "done";
const signupSteps: Step[] = ["identity", "email", "consent", "otp", "pin", "confirm"];
const prompts: Record<Step, [string, string]> = {
  identity: ["Hi, I'm SIA. What should I call you?", "Let's start with your name and mobile number."],
  email: ["Where can I reach you?", "Use an email you can access. Your verification code will arrive there."],
  consent: ["A few important details first.", "Choose your country and age group, then review the policies."],
  otp: ["Let's verify your email.", "Enter the six-digit code from TopRank AI."],
  pin: ["Your next step: a six-digit PIN.", "Choose a private PIN that isn't a sequence or six matching digits."],
  confirm: ["Once more, just to be sure.", "Re-enter your PIN to finish."],
  login: ["Welcome back. Ready for today?", "Enter your mobile number and six-digit PIN."],
  password: ["Access your existing account.", "For existing password accounts and authorized staff."],
  done: ["Your new PIN is ready.", "Your previous sessions have ended. Log in with your mobile number and new PIN."],
};

export function SiaAuth({ mode }: { mode: "signup" | "login" }) {
  const [flow, setFlow] = useState<Flow>(mode), [step, setStep] = useState<Step>(mode === "signup" ? "identity" : "login");
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [email, setEmail] = useState("");
  const [country, setCountry] = useState(""), [ageBand, setAgeBand] = useState<AccountAgeBand | "">("");
  const [guardianApproval, setGuardian] = useState(""), [terms, setTerms] = useState(false), [privacy, setPrivacy] = useState(false);
  const [code, setCode] = useState(""), [pin, setPin] = useState(""), [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState(""), [visiblePin, setVisiblePin] = useState(false);
  const [challenge, setChallenge] = useState(""), [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [resendAt, setResendAt] = useState(0), [remaining, setRemaining] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null), inFlight = useRef(false);
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); return () => element?.close(); }, []);
  useEffect(() => { dialog.current?.querySelector<HTMLInputElement>("input:not([type=checkbox]),select")?.focus(); }, [step, flow]);
  useEffect(() => { const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, [resendAt]);
  const registration = { name, phone, email, country, ageBand, termsAccepted: terms, privacyAccepted: privacy,
    termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION, ...(ageBand && needsGuardian(ageBand) ? { guardianApproval } : {}) };
  function clearSecrets() { setCode(""); setPin(""); setConfirmation(""); setPassword(""); setChallenge(""); setProof(""); setVisiblePin(false); }
  function switchFlow(next: Flow) { clearSecrets(); setError(""); setNotice(""); setFlow(next); setStep(next === "signup" ? "identity" : next === "reset" ? "email" : next); }
  async function sendCode() {
    const result = await studentRequest<{ challenge: string; resendAfter: number }>("/api/auth/pin", "POST", flow === "signup" ? { action: "requestSignup", registration } : { action: "requestReset", email });
    setChallenge(result.challenge); setProof(""); setCode(""); setResendAt(Date.now() + result.resendAfter * 1000); setNotice("Verification email accepted for sending. Check your inbox and spam folder."); setStep("otp");
  }
  async function work(operation: () => Promise<void>) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to continue. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await work(async () => {
      setNotice("");
      if (step === "identity") { setStep("email"); return; }
      if (step === "email") { if (flow === "signup") setStep("consent"); else await sendCode(); return; }
      if (step === "consent") { await sendCode(); return; }
      if (step === "otp") { const result = await studentRequest<{ proof: string }>("/api/auth/pin", "POST", { action: "verify", challenge, code }); setProof(result.proof); setCode(""); setNotice("Email verified."); setStep("pin"); return; }
      if (step === "pin") {
        if (!/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || ["123456", "654321"].includes(pin)) throw new Error("Choose six digits without a simple sequence or six matching digits.");
        setConfirmation(""); setVisiblePin(false); setStep("confirm"); return;
      }
      if (step === "confirm") {
        if (pin !== confirmation) throw new Error("Those PINs don't match. Please try again.");
        await studentRequest("/api/auth/pin", "POST", { action: flow === "signup" ? "signup" : "reset", challenge, proof, pin, confirmPin: confirmation, ...(flow === "signup" ? { registration } : {}) });
        clearSecrets();
        if (flow === "signup") window.location.assign("/workspace"); else setStep("done"); return;
      }
      if (step === "login") { await studentRequest("/api/auth/pin", "POST", { action: "login", phone, pin }); clearSecrets(); window.location.assign("/workspace"); return; }
      if (step === "password") { await studentRequest("/api/auth/login", "POST", { email, password }); clearSecrets(); window.location.assign("/workspace"); return; }
      if (step === "done") switchFlow("login");
    });
  }
  function back() {
    setError(""); setNotice("");
    if (step === "confirm") { setConfirmation(""); setStep("pin"); return; }
    clearSecrets();
    if (flow === "signup") setStep(signupSteps[Math.max(0, signupSteps.indexOf(step) - 1)]);
    else if (step === "otp" || step === "pin") setStep("email"); else switchFlow("login");
  }
  const total = flow === "signup" ? 6 : flow === "reset" ? 4 : 1;
  const number = flow === "signup" ? signupSteps.indexOf(step) + 1 : flow === "reset" ? Math.max(1, ["email", "otp", "pin", "confirm"].indexOf(step) + 1) : 1;
  const mobileField = <label>Mobile number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[\s()-]/g, ""))} placeholder="+919876543210" pattern="\+[1-9][0-9]{7,14}" minLength={9} maxLength={16} required /><span className={styles.hint}>Include the country code, with no spaces: +919876543210</span></label>;
  const pinField = (confirm = false) => <label>{confirm ? "Confirm six-digit PIN" : "Six-digit PIN"}<input className={styles.digits} name={confirm ? "confirmPin" : "pin"} type={visiblePin ? "text" : "password"} inputMode="numeric" autoComplete={step === "login" ? "current-password" : "new-password"} value={confirm ? confirmation : pin} onChange={e => (confirm ? setConfirmation : setPin)(e.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} pattern="[0-9]{6}" required /><span className={styles.check}><input type="checkbox" checked={visiblePin} onChange={e => setVisiblePin(e.target.checked)} /> Show PIN</span></label>;
  return <main className={styles.stage}>
    <header className={styles.brand}><Brand /><a href="/">Back to TopRank</a></header>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="sia-auth-title" aria-describedby="sia-auth-description" onCancel={event => { event.preventDefault(); if (!busy && window.confirm("Leave signup or login? Your unsaved details will be cleared.")) window.location.assign("/"); }}>
      <div className={styles.toolbar}><span className={styles.companion}><span className={styles.mark}><Icon name="spark" /></span><span><strong>SIA</strong><small>Your study companion</small></span></span>
        <button type="button" className={styles.iconButton} aria-label="Close" title="Close" disabled={busy} onClick={() => { if (window.confirm("Leave this account setup?")) window.location.assign("/"); }}>&times;</button></div>
      <div className={styles.content}><div className={styles.step}><span>{flow === "signup" ? "YOUR TOPRANK JOURNEY" : flow === "reset" ? "RECOVER YOUR PIN" : "YOUR NEXT STUDY DAY"}</span><span>{Math.max(1, number)} / {total}</span></div>
        <progress value={Math.max(1, number)} max={total} aria-label="Account setup progress" />
        <div key={step} className={styles.introduction}><h1 id="sia-auth-title">{prompts[step][0]}</h1><p id="sia-auth-description">{prompts[step][1]}</p></div>
        <form onSubmit={submit} className={styles.form}><fieldset disabled={busy}>
          {step === "identity" && <><label>Your name<input name="name" autoComplete="name" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={120} required /></label>{mobileField}</>}
          {step === "email" && <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required /></label>}
          {step === "consent" && <><div className={styles.row}><label>Country<select required value={country} onChange={e => setCountry(e.target.value)}><option value="">Choose country</option><option value="IN">India</option><option value="AE">United Arab Emirates</option></select></label><label>Age group<select required value={ageBand} onChange={e => { setAgeBand(e.target.value as AccountAgeBand); setGuardian(""); }}><option value="">Choose age group</option><option value="UNDER_13">Under 13</option><option value="13_TO_17">13 to 17</option><option value="18_PLUS">18 or older</option></select></label></div>
            {ageBand && needsGuardian(ageBand) && <label>Guardian authorization code<input type="password" autoComplete="off" value={guardianApproval} onChange={e => setGuardian(e.target.value)} minLength={43} maxLength={43} required /><a href="/guardian-registration" target="_blank" rel="noreferrer">Guardian authorization</a></label>}
            <label className={styles.check}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} required /> <span>I accept the <a href="/terms" target="_blank" rel="noreferrer">Terms</a>.</span></label>
            <label className={styles.check}><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} required /> <span>I accept the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.</span></label></>}
          {step === "otp" && <><p className={styles.destination}>{email}</p><label>Email verification code<input className={styles.digits} name="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label><button type="button" className={styles.textButton} disabled={busy || remaining > 0} onClick={() => void work(sendCode)}>{remaining > 0 ? `Resend in ${remaining}s` : "Resend email code"}</button></>}
          {(step === "pin" || step === "confirm") && pinField(step === "confirm")}
          {step === "login" && <>{mobileField}{pinField()}</>}
          {step === "password" && <><label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} /></label><a href="/recover-account">Forgot password?</a></>}
        </fieldset>
        {notice && <p className={styles.notice} role="status">{notice}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>{!["identity", "login", "done", "password"].includes(step) && <button type="button" className={styles.iconButton} disabled={busy} onClick={back} aria-label="Previous step" title="Previous step"><span className={styles.back}><Icon name="arrow" /></span></button>}
          <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Please wait..." : step === "done" ? "Back to login" : step === "confirm" ? flow === "signup" ? "Create my account" : "Save new PIN" : step === "login" || step === "password" ? "Log in" : step === "otp" ? "Verify email" : step === "consent" || flow === "reset" && step === "email" ? "Send email code" : "Continue"}<Icon name="arrow" /></button></div>
        </form>
        <footer className={styles.footer}>{step === "login" && <button type="button" disabled={busy} onClick={() => switchFlow("reset")}>Forgot PIN?</button>}
          <button type="button" disabled={busy} onClick={() => switchFlow(flow === "signup" ? "login" : "signup")}>{flow === "signup" ? "Already have an account? Log in" : "New to TopRank? Join us"}</button>
          {flow !== "signup" && flow !== "password" && <button type="button" disabled={busy} onClick={() => switchFlow("password")}>Existing password account / staff</button>}</footer>
      </div>
    </dialog>
    <p className={styles.signature}>A little progress. Every day.</p>
  </main>;
}
