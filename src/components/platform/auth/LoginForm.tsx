"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/platform/Icon";
import { toast } from "@/components/platform/AppToaster";
import { loginUser } from "@/server/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const toastId = toast.loading("Signing you in…");
    startTransition(async () => {
      const result = await loginUser({ email, password });
      if (!result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }
      toast.success("Signed in.", { id: toastId });
      router.replace(result.redirectTo);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="tp-stack tp-gap-16">
      <div className="tp-field">
        <label className="tp-label" htmlFor="email">Email address</label>
        <input className="tp-input" id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>

      <div className="tp-field">
        <label className="tp-label" htmlFor="password">Password</label>
        <div style={{ position: "relative" }}>
          <input
            className="tp-input"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Your password"
            style={{ paddingRight: 46 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{
              position: "absolute", right: 8, top: 8, width: 32, height: 32, display: "grid", placeItems: "center",
              border: 0, background: "transparent", color: "var(--tp-faint)", cursor: "pointer",
            }}
          >
            <Icon name="eye" size={17} />
          </button>
        </div>
      </div>

      <button className="tp-btn tp-btn-lg tp-btn-block" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"} {pending ? null : <Icon name="arrow-right" size={16} />}
      </button>

      <p className="tp-small tp-muted tp-center">
        New to TopRank? <Link className="tp-link" href="/register">Create an account</Link>
      </p>
    </form>
  );
}
