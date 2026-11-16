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
    <div className="tp-auth">
      <aside className="tp-auth-aside">
        <Link className="tp-brand" href="/">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>
        <div>
          <p className="tp-auth-quote">
            The paper is waiting.<br />
            <em>Pick up where you left off.</em>
          </p>
          <div className="tp-auth-points">
            {[
              "Your streak, revision queue and readiness score are exactly as you left them.",
              "Every recorded score is deterministic and stored against your account.",
              "Switch exams or levels whenever your plan changes.",
            ].map((point) => (
              <div className="tp-auth-point" key={point}>
                <Icon name="check" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="tp-xs" style={{ color: "rgba(244,241,255,0.55)" }}>
          Exam details belong to their official authorities. Always verify current patterns.
        </p>
      </aside>

      <main className="tp-auth-main" id="main">
        <div className="tp-auth-card">
          <div className="tp-row-between" style={{ marginBottom: 26 }}>
            <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/">
              <Icon name="arrow-left" size={15} /> Home
            </Link>
            <ThemeCycle />
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to continue today&apos;s preparation loop.</p>
          <div className="tp-mt-32">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
