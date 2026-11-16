import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { LogoMark } from "@/components/platform/Logo";
import { ThemeCycle } from "@/components/platform/ThemeCycle";
import { AdminLoginForm } from "@/components/platform/auth/AdminLoginForm";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administrator sign in",
  description: "Separate administrator access for the TopRank AI operations workspace.",
};

export default async function AdminLoginPage() {
  const user = await getCurrentUser(true);
  if (user?.role === "PLATFORM_ADMIN" && !user.requiresLegalConsent) redirect("/admin");

  return (
    <div className="tp-auth">
      <aside className="tp-auth-aside">
        <Link className="tp-brand" href="/">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>
        <div>
          <p className="tp-auth-quote">
            Operations, separated.<br />
            <em>Candidate accounts stay candidate-only.</em>
          </p>
          <div className="tp-auth-points">
            {[
              "This is a dedicated administrator entry point, not the candidate login.",
              "Review AI-generated exam patterns, questions and syllabus imports.",
              "Suspend accounts, verify dates and audit every AI call.",
            ].map((point) => (
              <div className="tp-auth-point" key={point}>
                <Icon name="check" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="tp-xs" style={{ color: "rgba(244,241,255,0.55)" }}>
          Administrator credentials are separate from candidate accounts.
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
          <span className="tp-eyebrow">Administration</span>
          <h1 style={{ marginTop: 10 }}>Administrator access</h1>
          <p>Sign in to the operations workspace. Candidate accounts cannot use this page.</p>
          <div className="tp-mt-24">
            <AdminLoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
