"use client";

import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { PasswordInput } from "../auth/PasswordInput";
import { toast } from "../AppToaster";
import { changeCandidatePassword } from "@/server/actions/auth";

export function PasswordSettings() {
  const [pending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const toastId = toast.loading("Updating your password…");
    startTransition(async () => {
      const result = await changeCandidatePassword({ newPassword, confirmPassword });
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success(result.message, { id: toastId });
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <section className="tp-card tp-card-pad">
      <div className="tp-row-between tp-gap-12 tp-wrap" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>Change password</h2>
          <p className="tp-xs tp-faint" style={{ marginTop: 3 }}>
            Choose a new password. You are already signed in, so your current password is not required.
          </p>
        </div>
        <span className="tp-pill"><Icon name="lock" size={13} /> Account security</span>
      </div>

      <form className="tp-stack tp-gap-14" onSubmit={onSubmit}>
        <div className="tp-grid tp-grid-2">
          <div className="tp-field">
            <label className="tp-label" htmlFor="profile-new-password">New password</label>
            <PasswordInput
              className="tp-input"
              id="profile-new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              maxLength={72}
              required
            />
          </div>
          <div className="tp-field">
            <label className="tp-label" htmlFor="profile-confirm-password">Confirm new password</label>
            <PasswordInput
              className="tp-input"
              id="profile-confirm-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Type it again"
              minLength={8}
              maxLength={72}
              required
            />
          </div>
        </div>

        <div className="tp-row tp-gap-8 tp-wrap">
          <button type="submit" className="tp-btn" disabled={pending}>
            {pending ? "Updating…" : "Update password"} {pending ? null : <Icon name="check" size={15} />}
          </button>
          <span className="tp-xs tp-faint">Entering your current password again is not needed while you are signed in.</span>
        </div>
      </form>
    </section>
  );
}
