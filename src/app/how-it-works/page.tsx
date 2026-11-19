import Link from "next/link";
import { Icon, type IconName } from "@/components/platform/Icon";
import { PublicShell } from "@/components/platform/PublicShell";

export const metadata = {
  title: "How it works",
  description: "The TopRank AI daily preparation loop: exam selection, daily paper, deterministic scoring, syllabus tracking and revision.",
};

const loop: { icon: IconName; title: string; body: string; points: string[] }[] = [
  {
    icon: "layers",
    title: "1 · Choose exams and levels",
    body: "Registration collects your profile, then asks you to choose one or more exams grouped by category.",
    points: [
      "A separate preparation level per exam — Beginner, Intermediate, Advanced or Extreme.",
      "Beginner includes one paper a day, Intermediate two, Advanced three and Extreme four. You can schedule up to eight and choose an IST start time for each exam.",
      "Papers above your level allowance need a monthly plan from Subscriptions. Riser, Scholar and Topper also add custom tests, advanced analytics, report cards, revision sheets, streak freezes and a larger AI allowance.",
      "Each level also sets a daily study target.",
      "You can change exams, levels, start times and study minutes later from your workspace.",
    ],
  },
  {
    icon: "play",
    title: "2 · Sit today's paper",
    body: "A timed paper is assembled deterministically from the reviewed question bank for your exam.",
    points: [
      "Each sitting has a stable selection of questions. Full mocks follow the official paper pattern when the reviewed bank covers its sections. Otherwise, you receive a labelled practice set.",
      "A question palette lets you flag and revisit before submitting.",
      "The timer is enforced on the server; an expired paper is submitted automatically.",
    ],
  },
  {
    icon: "target",
    title: "3 · Deterministic scoring",
    body: "Every mark, penalty and percentage is calculated on the server from the stored answer key.",
    points: [
      "Correct answers earn the question's positive marks; incorrect answers apply negative marking.",
      "Accuracy is correct ÷ attempted — unanswered questions never inflate it.",
      "The AI never calculates an objective score. It only interprets numbers that already exist.",
    ],
  },
  {
    icon: "book",
    title: "4 · Study and revise",
    body: "Each wrong answer enters the revision queue with a due date based on your performance.",
    points: [
      "Every wrong answer enters the revision queue, and paid plans can also print a sheet of the last 30 days of mistakes with the exam's published formulas.",
      "Topic progress is tracked as not started, learning, completed or needs revision.",
      "Choose Revise topic in the planner to open the exact syllabus topic behind a mistake — not the old exam result.",
      "The learning centre holds every official unit, chapter and topic, with the official source passage, your saved topics and AI-assisted notes where available.",
      "Your daily study target is minutes spent studying or revising syllabus topics. Sitting a paper is tracked separately.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <section className="tp-section" style={{ paddingBottom: 0 }}>
        <div className="tp-shell">
          <div className="tp-section-head" style={{ maxWidth: 780 }}>
            <span className="tp-eyebrow">How it works</span>
            <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)", letterSpacing: "-0.035em", margin: "14px 0" }}>
              A preparation loop built on <span className="tp-gradient-text">real work.</span>
            </h1>
            <p className="tp-lede">
              TopRank AI is not a video library with a progress bar. It is a daily exam loop with
              server-side scoring, a syllabus that maps to your paper and analytics you can actually
              defend.
            </p>
          </div>
        </div>
      </section>

      <section className="tp-section">
        <div className="tp-shell tp-grid tp-grid-2">
          {loop.map((item) => (
            <article className="tp-card tp-card-pad tp-card-lift" key={item.title} data-reveal>
              <span className="tp-feature-icon"><Icon name={item.icon} /></span>
              <h3 style={{ fontSize: 21, marginBottom: 8 }}>{item.title}</h3>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.65 }}>{item.body}</p>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none" }} className="tp-stack tp-gap-8">
                {item.points.map((point) => (
                  <li className="tp-row tp-gap-8 tp-small" key={point} style={{ alignItems: "flex-start" }}>
                    <span style={{ color: "var(--tp-ok)", marginTop: 1 }}><Icon name="check" size={16} /></span>
                    <span className="tp-muted">{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-grid tp-grid-2">
            <div className="tp-card tp-card-pad" data-reveal>
              <span className="tp-pill tp-pill-brand">AI, honestly</span>
              <h2 style={{ fontSize: 26, margin: "14px 0 10px", letterSpacing: "-0.03em" }}>What the AI does — and does not do</h2>
              <div className="tp-stack tp-gap-12 tp-small tp-muted">
                <p><strong style={{ color: "var(--tp-ink)" }}>It explains:</strong> post-exam feedback references your exact recorded numbers.</p>
                <p><strong style={{ color: "var(--tp-ink)" }}>It drafts:</strong> admins can generate question drafts, but every draft is unpublished until a human reviews it.</p>
                <p><strong style={{ color: "var(--tp-ink)" }}>It plans:</strong> a daily study plan is suggested from your weak topics and available minutes.</p>
                <p><strong style={{ color: "var(--tp-ink)" }}>It never scores:</strong> marks, negative marking and accuracy are computed deterministically on the server.</p>
                <p><strong style={{ color: "var(--tp-ink)" }}>It never invents:</strong> exam dates, ranks, cut-offs or seat guarantees are outside its remit.</p>
              </div>
              <div className="tp-note tp-mt-24">
                <strong>Provider.</strong> Google Gemini assists with feedback wording, study notes and draft questions.
                Every score is calculated by the platform, never by the AI.
              </div>
            </div>

            <div className="tp-card tp-card-pad" data-reveal>
              <span className="tp-pill tp-pill-accent">Content, honestly</span>
              <h2 style={{ fontSize: 26, margin: "14px 0 10px", letterSpacing: "-0.03em" }}>Where the syllabus comes from</h2>
              <div className="tp-stack tp-gap-12 tp-small tp-muted">
                <p>
                  There is no single free official API that publishes every Indian competitive exam
                  syllabus and date in a machine-readable form. Claiming otherwise would be dishonest.
                </p>
                <p>
                  Instead, the platform ships a curated syllabus library built from publicly published
                  official syllabi, with the official website linked on each exam. Administrators can add
                  or edit units, chapters and topics. A provider interface is in place for importing from
                  a future official source.
                </p>
                <p>
                  Exam dates are only displayed when an administrator records the event with a source
                  link. Until then, the calendar honestly says <em>not announced</em>.
                </p>
              </div>
              <div className="tp-row tp-gap-12 tp-mt-24 tp-wrap">
                <Link className="tp-btn tp-btn-soft" href="/exams">Browse the catalogue</Link>
                <Link className="tp-btn tp-btn-ghost" href="/faq">Read the FAQ</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-band" data-reveal>
            <h2>Ready to start the loop?</h2>
            <p>Create an account, pick your exams and level, and the first daily paper is prepared for you.</p>
            <div className="tp-band-actions">
              <Link className="tp-btn tp-btn-accent tp-btn-lg" href="/register">Create free account</Link>
              <Link className="tp-btn tp-btn-ghost tp-btn-lg" href="/exams">See exam pathways</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
