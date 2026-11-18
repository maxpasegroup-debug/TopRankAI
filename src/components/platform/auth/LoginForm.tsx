"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/platform/Icon";
import { PasswordInput } from "@/components/platform/auth/PasswordInput";
import { toast } from "@/components/platform/AppToaster";
import { loginUser } from "@/server/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
        <PasswordInput
          className="tp-input"
          id="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
        />
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
