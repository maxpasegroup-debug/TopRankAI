import Link from "next/link";
import { PublicShell } from "@/components/platform/PublicShell";

export const metadata = {
  title: "Frequently asked questions",
  description: "Answers about scoring, AI use, syllabus sources, exam dates, accounts and data.",
};

const faqs: { q: string; a: string }[] = [
  {
    q: "Does the AI calculate my score?",
    a: "No. Marks, negative marking, accuracy, subject and topic breakdowns are calculated deterministically on the server from the stored answer key and the answers you submitted. The AI may explain those numbers in plain language, but it cannot change them.",
  },
  {
    q: "Which AI provider does the platform use?",
    a: "Google Gemini generates feedback wording, study notes and draft questions. It never calculates marks, accuracy or ranks — those always come from the platform’s own scoring code.",
  },
  {
    q: "Where do the syllabus and exam dates come from?",
    a: "There is no single free official API covering every Indian competitive exam syllabus and date. The platform ships a curated syllabus library sourced from publicly published official syllabi, with the official website linked per exam. Dates are only shown when an administrator records a verified event with a source link. Unconfirmed dates are shown as not announced rather than guessed.",
  },
  {
    q: "Can I prepare for more than one exam?",
    a: "Yes. During registration you choose multiple exams grouped by category, and you set a separate preparation level for each: Beginner, Intermediate, Advanced or Extreme. Your primary exam drives the daily paper; you can switch the active exam from the workspace.",
  },
  {
    q: "How is the daily paper selected?",
    a: "Each scheduled sitting is assembled from the reviewed question bank for your exam, using the complete official pattern: the same question count, duration, total marks and marking rules as the real paper. When the bank covers every official section you receive a full mock; otherwise the paper is clearly labelled as a practice set. Opening the same sitting again gives you the same questions.",
  },
  {
    q: "Can I schedule several papers at different times?",
    a: "Yes. Every exam in your plan has its own papers-per-day setting and IST start time on the daily page. The first paper opens at your chosen time; later papers follow after you submit the previous one and a 45-minute break. Your level includes one to four papers a day, Riser raises that to six, and Scholar or Topper raise it to eight.",
  },
  {
    q: "What does each plan include?",
    a: "There are four monthly tiers. Aspirant is free and includes one to four daily papers depending on your level, the learning centre, planner, revision queue, core analytics and a small AI allowance. Riser at ₹99 adds six papers a day, two custom tests a day, advanced analytics, the printable report card and revision sheet, one streak freeze a month and a larger AI allowance. Scholar at ₹299 adds eight papers a day, five custom tests a day, the weekly report card with the previous week beside it, two streak freezes, photo answer checks and more AI. Topper at ₹599 adds ten custom tests a day, four streak freezes, a four-week trend, one month of AI credit rollover and the largest AI allowance. AI never marks a paper: AI feedback is coaching, while every score stays deterministic. Checkout accepts card or UPI details; the card number and CVV are never stored. Renewal is manual — extra time is added after your current expiry.",
  },
  {
    q: "What is the learning centre?",
    a: "The learning centre lists the official units, chapters and topics for your exam. Opening a topic shows the official syllabus passage with its source link, any curated or clearly labelled AI-assisted notes, official external resources and previous/next navigation. You can search topics, save them and mark progress; the planner sends you to the exact topic for revision.",
  },
  {
    q: "What happens if I run out of time?",
    a: "The attempt deadline is stored on the server. An expired paper is submitted automatically with whatever answers were saved, and it is scored exactly like a manual submission. Unanswered questions carry no penalty.",
  },
  {
    q: "How is the readiness score calculated?",
    a: "Readiness is a transparent weighted score: recent attendance, answer accuracy, question volume, syllabus coverage and current streak. Every component is shown with the inputs behind it, so you can see why the number moved.",
  },
  {
    q: "Who can create an account?",
    a: "Self-registration in this build is available to candidates aged 18 and over. Accounts for younger candidates require verified guardian consent, which is not enabled in this build. This is a documented limitation, not a hidden restriction.",
  },
  {
    q: "Can I change my exam or level later?",
    a: "Yes. The workspace includes an exam plan page where you can add or remove exams, change each preparation level and update your daily study time. Your previous attempts and progress remain attached to your account.",
  },
  {
    q: "What data does the platform store?",
    a: "Your profile details, selected exams and levels, attempts and answers, topic progress, revision items, achievements and notifications. AI usage is logged with operation, latency and success so administrators can monitor cost and reliability. See the privacy notice for the full description.",
  },
  {
    q: "Is the platform free?",
    a: "Aspirant is free and includes one to four daily papers depending on your level, plus the learning centre, planner, revision queue and core analytics. Riser, Scholar and Topper are monthly plans that raise the paper limit and add custom tests, reports, streak freezes and a larger AI allowance. A plan is activated from Subscriptions by card or UPI and does not renew automatically.",
  },
  {
    q: "How do I report a wrong question or date?",
    a: "Use the contact page. Administrators can archive a question immediately and record a corrected calendar event with the official source. Every correction is visible through the platform's content review status.",
  },
];

export default function FaqPage() {
  return (
    <PublicShell>
      <section className="tp-section" style={{ paddingBottom: 0 }}>
        <div className="tp-shell">
          <div className="tp-section-head" style={{ maxWidth: 720 }}>
            <span className="tp-eyebrow">Questions &amp; answers</span>
            <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)", letterSpacing: "-0.035em", margin: "14px 0" }}>
              Straight answers, <span className="tp-gradient-text">including the limits.</span>
            </h1>
            <p className="tp-lede">
              If something here is not true of the build you are using, that is a bug worth reporting.
            </p>
          </div>
        </div>
      </section>

      <section className="tp-section">
        <div className="tp-shell" style={{ maxWidth: 860 }}>
          <div className="tp-faq">
            {faqs.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <div className="tp-note tp-mt-32">
            <strong>Still stuck?</strong> Visit the <Link className="tp-link" href="/contact">contact page</Link> or read the{" "}
            <Link className="tp-link" href="/terms">terms of use</Link> and <Link className="tp-link" href="/privacy">privacy notice</Link>.
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
