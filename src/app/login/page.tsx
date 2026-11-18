import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { LogoMark } from "@/components/platform/Logo";
import { LoginForm } from "@/components/platform/auth/LoginForm";
import { ThemeCycle } from "@/components/platform/ThemeCycle";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  description: "Sign in to your TopRank AI preparation workspace.",
};

export default async function LoginPage() {
  const user = await getCurrentUser(true);
  if (user && !user.requiresLegalConsent) redirect(user.role === "PLATFORM_ADMIN" ? "/admin" : "/app");

  return (
    <div className="tp-register-stage">
      <header className="mx-auto flex w-full max-w-page items-center justify-between gap-4 px-[clamp(16px,4vw,34px)] py-4">
        <Link className="tp-brand" href="/" aria-label="TopRank AI home">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeCycle />
          <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/">
            <Icon name="arrow-left" size={15} /> Home
          </Link>
        </div>
      </header>

      <main className="tp-auth-main" id="main">
        <section
          className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          aria-labelledby="login-title"
        >
          <div className="px-4 pt-4 sm:px-5">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Sign in</p>
            <h1
              id="login-title"
              className="text-[clamp(22px,3.6vw,26px)] font-bold leading-tight tracking-[-0.02em] text-ink"
            >
              Welcome back
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Sign in to continue today&apos;s preparation loop.
            </p>
          </div>

          <div className="px-4 pb-4 pt-4 sm:px-5">
            <LoginForm />
          </div>

          <div className="border-t border-line bg-surface-2 px-4 py-3 sm:px-5">
            <p className="text-[11.5px] leading-relaxed text-faint">
              Your streak, revision queue and readiness score are exactly as you left them.
            </p>
          </div>
        </section>
      </main>

      <p className="px-[clamp(16px,4vw,34px)] pb-8 text-center text-[11.5px] text-faint">
        Exam details belong to their official authorities. Always verify current patterns.
      </p>
    </div>
  );
}
