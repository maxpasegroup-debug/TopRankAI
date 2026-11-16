"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { loginAdmin, resetAdminPassword } from "@/server/actions/auth";

export function AdminLoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await loginAdmin({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    });
  }

  function reset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await resetAdminPassword({
        email: String(data.get("email") ?? ""),
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setResetEmail(String(data.get("email") ?? ""));
      setMessage(result.message);
      setMode("login");
    });
  }

  return (
    <div className="tp-stack tp-gap-16">
      <div className="tp-tabs" style={{ width: "100%" }}>
        <button type="button" className="tp-tab" data-active={mode === "login"} onClick={() => { setMode("login"); setError(null); setMessage(null); }} style={{ flex: 1 }}>
          Administrator sign in
        </button>
        <button type="button" className="tp-tab" data-active={mode === "reset"} onClick={() => { setMode("reset"); setError(null); setMessage(null); }} style={{ flex: 1 }}>
          Reset password
        </button>
      </div>

      {message ? <div className="tp-success" role="status">{message}</div> : null}
      {error ? <div className="tp-error" role="alert">{error}</div> : null}

      {mode === "login" ? (
        <form onSubmit={signIn} className="tp-stack tp-gap-16">
          <div className="tp-field">
            <label className="tp-label" htmlFor="admin-email">Administrator email</label>
            <input id="admin-email" name="email" type="email" autoComplete="email" required className="tp-input" placeholder="admin@example.com" defaultValue={resetEmail} />
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="tp-input" placeholder="Your administrator password" />
          </div>
          <button type="submit" className="tp-btn tp-btn-lg tp-btn-block" disabled={pending}>
            {pending ? "Signing in…" : "Open admin workspace"} {pending ? null : <Icon name="arrow-right" size={16} />}
          </button>
        </form>
      ) : (
        <form onSubmit={reset} className="tp-stack tp-gap-16">
          <div className="tp-field">
            <label className="tp-label" htmlFor="reset-email">Administrator email</label>
            <input id="reset-email" name="email" type="email" autoComplete="email" required className="tp-input" placeholder="admin@example.com" />
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="reset-current">Current password</label>
            <input id="reset-current" name="currentPassword" type="password" autoComplete="current-password" required className="tp-input" />
            <span className="tp-hint">Password reset requires the current password. There is no email recovery in this build.</span>
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="reset-new">New password</label>
            <input id="reset-new" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="tp-input" />
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="reset-confirm">Confirm new password</label>
            <input id="reset-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="tp-input" />
          </div>
          <button type="submit" className="tp-btn tp-btn-lg tp-btn-block" disabled={pending}>
            {pending ? "Updating…" : "Update administrator password"} {pending ? null : <Icon name="lock" size={16} />}
          </button>
          <p className="tp-xs tp-faint">
            All active administrator sessions are revoked after a reset.
          </p>
        </form>
      )}
    </div>
  );
}
