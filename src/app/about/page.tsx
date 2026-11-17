import Link from "next/link";
import { Icon } from "@/components/platform/Icon";
import { PublicShell } from "@/components/platform/PublicShell";
import { getPlatformStats } from "@/server/platform/public";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "About",
  description: "Why TopRank AI exists, how it is built, and the principles behind honest exam preparation.",
};

const principles = [
  ["Deterministic first", "If a number can be computed, it is computed — not generated. Scores, penalties and accuracy live in the database, not in a model."],
  ["Content before cleverness", "A daily paper is only as good as its questions. Every seeded question is reviewed before it can appear in a paper."],
  ["Honest states", "No exam date is shown unless it was recorded with a source. No readiness score is shown unless there is activity behind it."],
  ["Learner control", "You choose the exams and the level per exam. You can study a topic, mark it, or revise it without being forced down a single path."],
];

export default async function AboutPage() {
  const stats = await getPlatformStats();
  return (
    <PublicShell>
      <section className="tp-section" style={{ paddingBottom: 0 }}>
        <div className="tp-shell">
          <div className="tp-section-head" style={{ maxWidth: 820 }}>
            <span className="tp-eyebrow">About TopRank AI</span>
            <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)", letterSpacing: "-0.035em", margin: "14px 0" }}>
              Built for the student who <span className="tp-gradient-text">shows up daily.</span>
            </h1>
            <p className="tp-lede">
              Indian competitive exams reward consistency more than any single brilliant study session.
              Choose a daily paper schedule that fits your preparation level and use your results
              to see which syllabus topics to study next.
            </p>
          </div>
        </div>
      </section>

      <section className="tp-section">
        <div className="tp-shell">
          <div className="tp-admin-grid">
            {[
              [stats.exams, "Exam pathways"],
              [stats.topics.toLocaleString("en-IN"), "Syllabus topics"],
              [stats.questions, "Reviewed questions"],
              [stats.achievements, "Achievements"],
            ].map(([value, label]) => (
              <div className="tp-admin-stat" key={label} data-reveal>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell tp-grid tp-grid-2">
          <div className="tp-card tp-card-pad" data-reveal>
            <h2 style={{ fontSize: 26, letterSpacing: "-0.03em", marginBottom: 12 }}>The product</h2>
            <div className="tp-stack tp-gap-12 tp-small tp-muted">
              <p>
                A candidate registers with a real profile, selects one or more exams grouped by category,
                and sets a preparation level for each. Every day the workspace prepares a timed paper from
                the reviewed question bank for the primary exam.
              </p>
              <p>
                After submission the server calculates marks, negative marking, accuracy and subject and
                topic breakdowns. Incorrect questions enter a spaced revision queue. The learning centre
                carries the syllabus with notes, and analytics derive readiness from recorded activity.
              </p>
              <p>
                Administrators manage the exam catalogue, categories, questions, syllabus, calendar,
                candidates and AI settings from a separate workspace with role-checked server actions.
              </p>
            </div>
          </div>

          <div className="tp-card tp-card-pad" data-reveal>
            <h2 style={{ fontSize: 26, letterSpacing: "-0.03em", marginBottom: 12 }}>The stack</h2>
            <div className="tp-stack tp-gap-8">
              {[
                ["Framework", "Next.js 16 App Router, React 19, TypeScript"],
                ["Database", "Neon PostgreSQL with Prisma 7"],
                ["Auth", "Server sessions, bcrypt password hashing, Zod validation"],
                ["AI", "Google Gemini (free tier) behind a validated task layer"],
                ["Motion", "GSAP with reduced-motion support"],
              ].map(([label, value]) => (
                <div className="tp-row-between tp-small" key={label}>
                  <span className="tp-muted">{label}</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="tp-note tp-mt-24">
              <strong>Account policy.</strong> Self-registration in this build is limited to candidates aged
              18 and over, because minors require verified guardian consent that is not yet enabled.
            </div>
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-section-head" data-reveal>
            <span className="tp-eyebrow">Principles</span>
            <h2>Four rules we do not break.</h2>
          </div>
          <div className="tp-grid tp-grid-2">
            {principles.map(([title, body]) => (
              <div className="tp-card tp-card-pad" key={title} data-reveal>
                <div className="tp-row tp-gap-8" style={{ marginBottom: 8 }}>
                  <span style={{ color: "var(--tp-brand)" }}><Icon name="check" size={18} /></span>
                  <h3 style={{ fontSize: 18 }}>{title}</h3>
                </div>
                <p className="tp-small tp-muted" style={{ lineHeight: 1.65 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-band" data-reveal>
            <h2>Start with today, not with a promise.</h2>
            <p>No rank guarantees. No invented cut-offs. Just a daily paper, a real score and the next topic to study.</p>
            <div className="tp-band-actions">
              <Link className="tp-btn tp-btn-accent tp-btn-lg" href="/register">Create free account</Link>
              <Link className="tp-btn tp-btn-ghost tp-btn-lg" href="/contact">Talk to us</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
