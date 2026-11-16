import Link from "next/link";
import { PublicShell } from "@/components/platform/PublicShell";
import { ACCOUNT_OPERATING_ENTITY, ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";

export const metadata = {
  title: "Privacy notice",
  description: "What data TopRank AI stores, why it is stored, and how to exercise your rights.",
};

const sections: { title: string; body: string[] }[] = [
  {
    title: "1. What we collect",
    body: [
      "Account details: name, email, password hash, and optionally a phone number and profile picture URL.",
      "Profile details you provide during registration: date of birth, gender, state, city, education stage and preferred language.",
      "Preparation data: selected exams, per-exam preparation level, daily study time, attempts, answers, topic progress, revision items, goals and achievements.",
      "Operational data: session records, audit events for account actions, notification records, and AI usage logs containing the operation, model, latency and success state.",
    ],
  },
  {
    title: "2. Why we store it",
    body: [
      "To assemble a daily paper for your exam and level, and to score it deterministically.",
      "To track syllabus progress, revision due dates and readiness analytics for your account.",
      "To keep the platform secure: sessions, rate limiting and audit events.",
      "To monitor AI reliability and cost through usage logs. Prompts are not resold.",
    ],
  },
  {
    title: "3. What we do not do",
    body: [
      "We do not publish your individual results or rank you against other candidates.",
      "We do not sell personal data.",
      "We do not use AI to decide your objective score.",
    ],
  },
  {
    title: "4. AI processing",
    body: [
      "When AI features are enabled, the minimum context needed for the task is sent to the configured provider (Google Gemini). For feedback, that context is the already-calculated result and your weakest subjects and topics — not your password, phone number or email.",
      "With no provider key configured, AI features are disabled and deterministic fallbacks are used.",
    ],
  },
  {
    title: "5. Retention and your rights",
    body: [
      "Account and preparation data are retained while your account is active. You may request access, correction or deletion.",
      "Signed-in candidates can raise a privacy request from the account area. You can also write to privacy@toprank.ai with your registered email.",
      "Some records may be retained where required for security, fraud prevention or legal obligations.",
    ],
  },
  {
    title: "6. Children",
    body: [
      "Self-registration in this build is limited to candidates aged 18 and over. Accounts for younger candidates require verified guardian consent, which is not enabled in this build.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <section className="tp-section">
        <div className="tp-shell" style={{ maxWidth: 820 }}>
          <span className="tp-eyebrow">Legal</span>
          <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", letterSpacing: "-0.035em", margin: "14px 0 10px" }}>Privacy notice</h1>
          <p className="tp-small tp-muted">Policy version {ACCOUNT_POLICY_VERSION} · Operated by {ACCOUNT_OPERATING_ENTITY}</p>

          <div className="tp-stack tp-gap-28 tp-mt-32">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 style={{ fontSize: 21, marginBottom: 10 }}>{section.title}</h2>
                <div className="tp-stack tp-gap-10">
                  {section.body.map((paragraph) => (
                    <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }} key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="tp-note tp-mt-32">
            <strong>Contact.</strong> Privacy requests: <a className="tp-link" href="mailto:privacy@toprank.ai">privacy@toprank.ai</a>.
            General support is available through the <Link className="tp-link" href="/contact">contact page</Link>.
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
