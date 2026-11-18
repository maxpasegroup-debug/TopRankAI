import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/platform/Icon";
import { LogoMark } from "@/components/platform/Logo";
import { ThemeCycle } from "@/components/platform/ThemeCycle";
import { RegisterConversation } from "@/components/platform/auth/RegisterConversation";
import { getCurrentUser } from "@/server/auth/session";
import { getRegistrationOptions } from "@/server/platform/public";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create your account",
  description: "Answer a few questions, choose your exams and start your first daily paper.",
};

export default async function RegisterPage() {
  const user = await getCurrentUser(true);
  if (user && !user.requiresLegalConsent) redirect(user.role === "PLATFORM_ADMIN" ? "/admin" : "/app");
  const groups = await getRegistrationOptions();

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
        <RegisterConversation groups={groups} currentYear={new Date().getFullYear()} />
      </main>

      <p className="px-[clamp(16px,4vw,34px)] pb-8 text-center text-[11.5px] text-faint">
        Self-registration is currently available for candidates aged 18 and over.
      </p>
    </div>
  );
}
