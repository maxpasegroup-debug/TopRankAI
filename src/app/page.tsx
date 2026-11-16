import Link from "next/link";
import { ExamCard } from "@/components/platform/ExamCard";
import { Icon, type IconName } from "@/components/platform/Icon";
import { PublicShell } from "@/components/platform/PublicShell";
import { getPlatformStats, getPublicCatalogue } from "@/server/platform/public";

export const dynamic = "force-dynamic";

const features: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "calendar",
    title: "A real paper every day",
    body: "Each day a fresh paper is assembled from the reviewed question bank for your exam, with the same marking rules you will face on exam day.",
  },
  {
    icon: "target",
    title: "Scores that never guess",
    body: "Marks, negative marking, accuracy and topic breakdowns are calculated on the server. The AI explains the numbers; it never invents them.",
  },
  {
    icon: "book",
    title: "Syllabus that maps to your exam",
    body: "Every unit, chapter and topic is tied to a verified syllabus, with per-topic progress so you know exactly what is left.",
  },
  {
    icon: "flame",
    title: "A habit, not a cram",
    body: "Streaks, daily goals and a spaced revision queue keep the loop moving. Missed days are recorded honestly, never hidden.",
  },
  {
    icon: "chart",
    title: "Readiness you can defend",
    body: "A transparent readiness score built from attendance, accuracy, question volume, syllabus coverage and consistency.",
  },
  {
    icon: "trophy",
    title: "Milestones worth earning",
    body: "Achievements unlock from real activity — papers completed, streaks held, accuracy reached and topics studied.",
  },
];

const steps = [
  { title: "Choose your exams", body: "Pick one or more exams by category and set a preparation level for each: Beginner, Intermediate, Advanced or Extreme." },
  { title: "Sit the daily paper", body: "A timed, exam-style paper is prepared for your level. Answer, flag and revisit before the clock runs out." },
  { title: "Read the deterministic result", body: "See marks, negative marking, accuracy and a subject and topic breakdown, calculated on the server." },
  { title: "Close the loop", body: "Study the explanation, mark the topic, and the missed idea enters your revision queue for the right day." },
];

export default async function HomePage() {
  const [stats, catalogue] = await Promise.all([getPlatformStats(), getPublicCatalogue()]);
  const featured = catalogue.exams.slice(0, 6);

  return (
    <PublicShell>
      <section className="tp-hero">
        <div className="tp-shell tp-hero-grid">
          <div data-reveal>
            <span className="tp-eyebrow">Daily exam preparation · India</span>
            <h1>
              Prepare like it is<br />
              <span className="tp-gradient-text">exam day. Every day.</span>
            </h1>
            <p className="tp-lede">
              TopRank AI turns your competitive exam into a daily rhythm: a real paper, a
              deterministic score, a clear explanation and a syllabus that tells you what to
              study next. No inflated ranks. No invented statistics.
            </p>
            <div className="tp-hero-actions">
              <Link className="tp-btn tp-btn-lg" href="/register">
                Start preparing <Icon name="arrow-right" size={17} />
              </Link>
              <Link className="tp-btn tp-btn-ghost tp-btn-lg" href="/exams">Browse exam catalogue</Link>
            </div>
            <div className="tp-hero-stats">
              <div className="tp-hero-stat">
                <strong>{stats.exams}</strong>
                <span>Exam pathways</span>
              </div>
              <div className="tp-hero-stat">
                <strong>{stats.topics.toLocaleString("en-IN")}</strong>
                <span>Syllabus topics</span>
              </div>
              <div className="tp-hero-stat">
                <strong>{stats.questions}</strong>
                <span>Reviewed questions</span>
              </div>
              <div className="tp-hero-stat">
                <strong>{stats.categories}</strong>
                <span>Categories</span>
              </div>
            </div>
          </div>

          <div className="tp-hero-visual" data-reveal data-reveal-delay="0.1">
            <div className="tp-hero-float tp-hero-float-a">
              <span className="tp-feature-icon" style={{ width: 30, height: 30, margin: 0, borderRadius: 9 }}>
                <Icon name="check" size={15} />
              </span>
              <div>
                <div>Deterministic score</div>
                <small>Calculated on the server</small>
              </div>
            </div>

            <div className="tp-hero-card">
              <div className="tp-row-between">
                <span className="tp-pill tp-pill-accent">Today&apos;s paper</span>
                <span className="tp-timer"><Icon name="clock" size={14} /> 180 min</span>
              </div>
              <div className="tp-row tp-gap-20" style={{ marginTop: 22 }}>
                <div className="tp-score-ring">72%</div>
                <div className="tp-grow">
                  <div style={{ fontFamily: "var(--tp-display)", fontWeight: 750, fontSize: 17 }}>NEET full mock</div>
                  <div className="tp-small tp-muted">180 questions · Physics, Chemistry, Biology</div>
                  <div className="tp-meter" style={{ marginTop: 12 }}><span style={{ width: "72%" }} /></div>
                </div>
              </div>
              <div className="tp-divider" style={{ margin: "20px 0" }} />
              <div className="tp-stack tp-gap-12">
                {[
                  ["Physics · Mechanics", "4 / 4", "ok"],
                  ["Chemistry · Equilibrium", "2 / 3", "warn"],
                  ["Biology · Genetics", "3 / 3", "ok"],
                ].map(([label, score, tone]) => (
                  <div className="tp-row-between tp-small" key={label}>
                    <span className="tp-muted">{label}</span>
                    <span className={`tp-pill ${tone === "ok" ? "tp-pill-ok" : "tp-pill-warn"}`}>{score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="tp-hero-float tp-hero-float-b">
              <span className="tp-streak-flame" style={{ width: 34, height: 34, borderRadius: 10 }}>
                <Icon name="flame" size={17} />
              </span>
              <div>
                <div>12-day streak</div>
                <small>Keep the rhythm</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tp-section">
        <div className="tp-shell">
          <div className="tp-section-head" data-reveal>
            <span className="tp-eyebrow">Why this loop works</span>
            <h2>Everything a serious aspirant needs — and nothing that pretends.</h2>
            <p className="tp-lede">
              The platform is built around verified content and server-side scoring. AI is used where
              it helps: explanations, study notes, feedback and planning.
            </p>
          </div>
          <div className="tp-grid tp-grid-3">
            {features.map((feature) => (
              <article className="tp-card tp-card-lift tp-feature" key={feature.title} data-reveal>
                <span className="tp-feature-icon"><Icon name={feature.icon} /></span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-section-head" data-reveal>
            <span className="tp-eyebrow">The daily loop</span>
            <h2>Four steps, repeated until it feels automatic.</h2>
          </div>
          <div className="tp-steps">
            {steps.map((step) => (
              <div className="tp-step" key={step.title} data-reveal>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-row-between" style={{ marginBottom: 26 }}>
            <div className="tp-section-head" style={{ marginBottom: 0 }} data-reveal>
              <span className="tp-eyebrow">Exam catalogue</span>
              <h2>Find the pathway you are working toward.</h2>
            </div>
            <Link className="tp-btn tp-btn-ghost" href="/exams">
              All exams <Icon name="arrow-right" size={16} />
            </Link>
          </div>
          <div className="tp-grid tp-grid-3">
            {featured.map((exam) => <ExamCard exam={exam} key={exam.code} />)}
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-band" data-reveal>
            <span className="tp-pill" style={{ background: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.24)", color: "#fff" }}>
              Free to start
            </span>
            <h2 style={{ marginTop: 16 }}>Your next paper is already waiting.</h2>
            <p>
              Create an account, choose your exams and set a level for each. The first daily paper is
              prepared from the reviewed question bank for your syllabus.
            </p>
            <div className="tp-band-actions">
              <Link className="tp-btn tp-btn-accent tp-btn-lg" href="/register">Create free account</Link>
              <Link className="tp-btn tp-btn-ghost tp-btn-lg" href="/how-it-works">How it works</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
