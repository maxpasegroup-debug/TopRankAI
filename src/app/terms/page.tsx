import Link from "next/link";
import { PublicShell } from "@/components/platform/PublicShell";
import { ACCOUNT_OPERATING_ENTITY, ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";

export const metadata = {
  title: "Terms of use",
  description: "The terms that govern use of the TopRank AI exam preparation platform.",
};

export default function TermsPage() {
  return (
    <PublicShell>
      <section className="tp-section">
        <div className="tp-shell" style={{ maxWidth: 820 }}>
          <span className="tp-eyebrow">Legal</span>
          <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", letterSpacing: "-0.035em", margin: "14px 0 10px" }}>Terms of use</h1>
          <p className="tp-small tp-muted">Policy version {ACCOUNT_POLICY_VERSION} · Operated by {ACCOUNT_OPERATING_ENTITY}</p>

          <div className="tp-stack tp-gap-28 tp-mt-32">
            <section>
              <h2 style={{ fontSize: 21, marginBottom: 10 }}>1. What the platform is</h2>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }}>
                TopRank AI is an exam-preparation workspace. It assembles practice papers from a curated
                question bank, calculates objective scores on the server, tracks syllabus progress and
                provides analytics. It is not an official examination body and does not represent any
                examining authority.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 21, marginBottom: 10 }}>2. Accuracy of content</h2>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }}>
                Exam patterns, marking schemes and syllabus structures change. The platform records its
                understanding of these publicly published details and links the official website for each
                exam. You must verify current details on the official website before relying on them.
                Where a date has not been recorded from an official source, the platform states that it is
                not announced rather than publishing a guess.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 21, marginBottom: 10 }}>3. Your account</h2>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }}>
                You are responsible for the accuracy of the profile information you provide and for keeping
                your password confidential. Self-registration in this build is limited to candidates aged
                18 and over. Accounts for younger candidates require verified guardian consent, which is not
                enabled in this build.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 21, marginBottom: 10 }}>4. Acceptable use</h2>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }}>
                Do not attempt to extract the question bank at scale, automate attempts, share account
                credentials, or interfere with scoring. Do not submit another person&apos;s work as your own.
                Access may be suspended where activity compromises the integrity of the platform.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 21, marginBottom: 10 }}>5. AI-assisted features</h2>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }}>
                Explanations, study notes, study plans and feedback may be produced with the assistance of
                a third-party language model. These outputs are labelled where relevant and may contain
                errors. They do not affect objective scoring, which is deterministic. AI-generated
                questions remain unpublished until a human administrator approves them.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 21, marginBottom: 10 }}>6. No guarantee of outcome</h2>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }}>
                The platform does not guarantee a rank, score, seat, admission or qualification. Readiness
                scores and analytics are descriptions of recorded activity, not predictions of results.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 21, marginBottom: 10 }}>7. Changes and contact</h2>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.75 }}>
                These terms may be updated as the platform develops; material changes will be reflected in
                the policy version. Questions can be sent through the <Link className="tp-link" href="/contact">contact page</Link>.
              </p>
            </section>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
