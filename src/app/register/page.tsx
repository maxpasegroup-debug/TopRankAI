import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { LogoMark } from "@/components/platform/Logo";
import { ThemeCycle } from "@/components/platform/ThemeCycle";
import { RegisterWizard } from "@/components/platform/auth/RegisterWizard";
import { getCurrentUser } from "@/server/auth/session";
import { getRegistrationOptions } from "@/server/platform/public";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create your account",
  description: "Create a TopRank AI account, choose your exams and set a preparation level for each.",
};

export default async function RegisterPage() {
  const user = await getCurrentUser(true);
  if (user && !user.requiresLegalConsent) redirect(user.role === "PLATFORM_ADMIN" ? "/admin" : "/app");
  const groups = await getRegistrationOptions();

  return (
    <div className="tp-auth">
      <aside className="tp-auth-aside">
        <Link className="tp-brand" href="/">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>
        <div>
          <p className="tp-auth-quote">
            Four steps today.<br />
            <em>A daily habit for the months ahead.</em>
          </p>
          <div className="tp-auth-points">
            {[
              "Choose one or more exams across engineering, medical, law, management and more.",
              "Set a separate preparation level for each exam — the daily paper adapts.",
              "Your first paper is prepared from the reviewed question bank immediately.",
            ].map((point) => (
              <div className="tp-auth-point" key={point}>
                <Icon name="check" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="tp-xs" style={{ color: "rgba(244,241,255,0.55)" }}>
          Self-registration is currently available for candidates aged 18 and over.
        </p>
      </aside>

      <main className="tp-auth-main" id="main">
        <div className="tp-auth-card">
          <div className="tp-row-between" style={{ marginBottom: 22 }}>
            <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/">
              <Icon name="arrow-left" size={15} /> Home
            </Link>
            <ThemeCycle />
          </div>
          <h1>Create your account</h1>
          <p>Already preparing? <Link className="tp-link" href="/login">Sign in instead</Link>.</p>
          <div className="tp-mt-24">
            <RegisterWizard groups={groups} currentYear={new Date().getFullYear()} />
          </div>
        </div>
      </main>
    </div>
  );
}
