"use client";

import { useEffect, useState } from "react";

const platformItems = [
  { label: "today's mission", value: "physics - motion" },
  { label: "today's practice", value: "30 questions" },
  { label: "current streak", value: "12 days" },
  { label: "progress", value: "64%" },
];

const showcaseItems = [
  { title: "Mission Control", label: "today", value: "motion basics", detail: "64%" },
  { title: "Learn", label: "lesson", value: "distance", detail: "12 min" },
  { title: "Practice", label: "set", value: "30 questions", detail: "medium" },
  { title: "Progress", label: "streak", value: "12 days", detail: "steady" },
  { title: "Tara", label: "mentor", value: "start small", detail: "next step" },
];

const audienceCards = [
  {
    eyebrow: "For students",
    title: "One focused goal for today.",
    rows: ["Today's Goal", "Physics", "Continue"],
  },
  {
    eyebrow: "For parents",
    title: "See effort without pressure.",
    rows: ["Progress", "Attendance", "Weekly Summary"],
  },
  {
    eyebrow: "For schools",
    title: "Understand engagement quickly.",
    rows: ["Engagement", "Participation", "Weekly Activity"],
  },
];

const journeyStages = [
  { title: "Dream", label: "goal", value: "AIIMS Delhi", detail: "NEET 2028" },
  { title: "Today's Mission", label: "focus", value: "motion basics", detail: "64%" },
  { title: "Learn", label: "lesson", value: "distance", detail: "12 min" },
  { title: "Practice", label: "set", value: "30 questions", detail: "guided" },
  { title: "Progress", label: "streak", value: "12 days", detail: "steady" },
  { title: "Dream College", label: "path", value: "getting closer", detail: "daily" },
];

const exams = ["NEET", "JEE", "KEAM", "CUET", "NDA"];

const faqs = [
  {
    question: "Which exams does TopRank support?",
    answer: "Daily missions adapt to NEET, JEE, KEAM, CUET, and NDA. Students pick a target exam during onboarding, and practice stays tied to that journey.",
  },
  {
    question: "What does a student do each day?",
    answer: "Mission Control gives one clear goal: a short lesson, a practice set, and a progress check. Tara suggests the next small step when the syllabus feels too large.",
  },
  {
    question: "Can parents see progress without adding pressure?",
    answer: "The parent view shows effort, attendance, and a weekly summary. It is built to make consistency visible, not to turn every score into a comparison.",
  },
  {
    question: "How do schools use TopRank?",
    answer: "Schools get a simple pulse of engagement, participation, and weekly activity so teachers can see who is showing up for the work.",
  },
  {
    question: "Do I need an account to look around?",
    answer: "The demo opens Mission Control without a database login. A real student account is required for saved lessons, practice history, and progress.",
  },
];

const trustSnapshots = [
  { title: "Daily Missions", label: "today", value: "one clear goal" },
  { title: "Practice First", label: "questions", value: "start with 30" },
  { title: "Parent View", label: "weekly", value: "effort visible" },
  { title: "School Pulse", label: "class", value: "engagement" },
  { title: "Tara Guidance", label: "mentor", value: "next step" },
  { title: "Progress Tracking", label: "growth", value: "64%" },
];

export function Landing() {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const hasSeenIntro = window.sessionStorage.getItem("toprank_intro_seen");

    if (!hasSeenIntro) {
      setShowIntro(true);
      window.sessionStorage.setItem("toprank_intro_seen", "true");
      const timer = window.setTimeout(() => setShowIntro(false), 2100);

      return () => window.clearTimeout(timer);
    }
  }, []);

  return (
    <main className="tr-landing">
      {showIntro ? (
        <div className="tr-intro" aria-label="TopRank intro">
          <h1>TopRank</h1>
          <p>Personalized Entrance Preparation</p>
          <span />
        </div>
      ) : null}

      <section className="tr-hero-stage">
      <nav className="tr-nav" aria-label="Public navigation">
        <a className="tr-logo" href="/">
          <span>TopRank</span>
          <small>Personalized Entrance Prep</small>
        </a>
        <div className="tr-nav-links">
          <a href="/">Home</a>
          <a href="#platform">Platform</a>
          <a href="#parents">Parents</a>
          <a href="#schools">Schools</a>
          <a href="#faq">FAQ</a>
          <a href="#about">About</a>
        </div>
        <div className="tr-nav-actions">
          <a className="tr-login" href="/login">Login</a>
          <a className="tr-demo tr-arrow" href="/demo/start">Start Demo</a>
        </div>
      </nav>

      <section className="tr-hero">
        <div className="tr-hero-copy">
          <p className="tr-eyebrow">Personalized daily preparation for entrance success</p>
          <h1>Every Dream Begins With Today's Mission.</h1>
          <p className="tr-hero-subtitle">
            TopRank gives students a clear daily mission, guided practice, steady progress,
            and Tara's calm mentor support for NEET, JEE, KEAM, CUET and school exams.
          </p>
          <div className="tr-hero-actions">
            <a className="tr-primary tr-arrow" href="/demo/start">Experience Mission Control</a>
            <a className="tr-secondary" href="/presentation-summary">Watch Student Journey</a>
          </div>
        </div>

        <div className="tr-product-preview" id="platform" aria-label="TopRank Mission Control preview">
          <div className="tr-hero-art-wrap">
            <span className="tr-float-tile tr-float-mission">Mission</span>
            <span className="tr-float-tile tr-float-practice">Practice</span>
            <span className="tr-float-tile tr-float-Vision">Vision</span>
            <span className="tr-float-tile tr-float-progress">Progress</span>
            <span className="tr-float-tile tr-float-Exams">Exams</span>
            <span className="tr-float-tile tr-float-Prepare">Prepare</span>
            <img
              className="tr-hero-art"
              src="/hero/student-laptop.png"
              alt="Student with a laptop and backpack"
            />
          </div>
          <div className="tr-preview-top">
            <div>
              <p>Mission Control</p>
              <h2>Rahul's day plan</h2>
            </div>
            <span>NEET 2028</span>
          </div>

          <div className="tr-preview-main">
            <section className="tr-mission-card">
              <p>Today's Mission</p>
              <h3>Master Motion basics</h3>
              <div className="tr-progress-line">
                <span />
              </div>
            </section>

            <section className="tr-tara-card">
              <div className="tr-tara-avatar">T</div>
              <div>
                <p>Tara</p>
                <strong>Start with 10 easy questions.</strong>
              </div>
            </section>
          </div>

          <div className="tr-preview-grid">
            {platformItems.map((item) => (
              <section key={item.label}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </section>
            ))}
          </div>
        </div>
      </section>
      </section>

      <section className="tr-showcase" aria-label="TopRank product flow">
        {showcaseItems.map((item, index) => (
          <article className="tr-showcase-card" key={item.title}>
            <div className="tr-showcase-top">
              <span>{index + 1}</span>
              <strong>{item.title}</strong>
            </div>
            <div className="tr-mini-ui">
              <p>{item.label}</p>
              <h3>{item.value}</h3>
              <small>{item.detail}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="tr-section tr-three" id="parents">
        {audienceCards.map((card) => (
          <div id={card.eyebrow === "For schools" ? "schools" : undefined} key={card.eyebrow}>
            <p className="tr-eyebrow">{card.eyebrow}</p>
            <h2>{card.title}</h2>
            <div className="tr-audience-preview">
              {card.rows.map((row) => (
                <span key={row}>{row}</span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="tr-section tr-journey" aria-label="How TopRank works">
        <div className="tr-section-heading">
          <p className="tr-eyebrow">How TopRank works</p>
          <h2>From dream to daily action.</h2>
        </div>
        <div className="tr-journey-row">
          {journeyStages.map((stage) => (
            <article className="tr-journey-card" key={stage.title}>
              <strong>{stage.title}</strong>
              <div className="tr-mini-ui">
                <p>{stage.label}</p>
                <h3>{stage.value}</h3>
                <small>{stage.detail}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="tr-section tr-tara-moment" aria-label="Tara mentor moment">
        <div className="tr-tara-quote">
          <p className="tr-eyebrow">The Tara moment</p>
          <h2>"Don't worry about tomorrow's syllabus. Let's finish today's mission first."</h2>
          <div className="tr-tara-signature">
            <span>T</span>
            <strong>Tara, your mentor</strong>
          </div>
        </div>
        <div className="tr-mentor-preview">
          <div className="tr-mentor-message student">Physics feels too much today.</div>
          <div className="tr-mentor-message tara">Start with Motion. Ten easy questions first.</div>
          <div className="tr-mentor-action">Continue today's mission</div>
        </div>
      </section>

      <section className="tr-section tr-exams" aria-label="Built for India's toughest exams">
        <div>
          <p className="tr-eyebrow">Built for India's toughest exams</p>
          <h2>Daily missions adapt to different exam journeys.</h2>
        </div>
        <div className="tr-exam-pills">
          {exams.map((exam) => (
            <span key={exam}>{exam}</span>
          ))}
        </div>
      </section>

      <section className="tr-section tr-trust" aria-label="Platform trust">
        <div className="tr-section-heading">
          <p className="tr-eyebrow">Why families and schools can trust it</p>
          <h2>TopRank makes effort visible.</h2>
        </div>
        <div className="tr-trust-grid">
          {trustSnapshots.map((item) => (
            <article className="tr-trust-snapshot" key={item.title}>
              <strong>{item.title}</strong>
              <div className="tr-mini-ui">
                <p>{item.label}</p>
                <h3>{item.value}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="tr-section tr-faq" id="faq" aria-label="Frequently asked questions">
        <div className="tr-section-heading">
          <p className="tr-eyebrow">FAQ</p>
          <h2>Questions families ask first.</h2>
        </div>
        <div className="tr-faq-list">
          {faqs.map((item) => (
            <details className="tr-faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="tr-section tr-about bg-black" id="about">
        <p className="tr-eyebrow">Ready for your first mission?</p>
        <h2>Your next rank starts with your next mission.</h2>
        <a className="tr-primary tr-arrow" href="/demo/start">Experience Mission Control</a>
      </section>

      <footer className="tr-footer">
        <div className="tr-footer-inner">
          <div className="tr-footer-brand">
            <a className="tr-logo" href="/">
              <span>TopRank</span>
              <small>Personalized Entrance Prep</small>
            </a>
            {/* <p>One daily mission for students, a calm view for parents, and a clear pulse for schools.</p> */}
          </div>
          <nav className="tr-footer-links" aria-label="Footer">
            <a href="#platform">Platform</a>
            <a href="#parents">Parents</a>
            <a href="#schools">Schools</a>
            <a href="#faq">FAQ</a>
            <a href="/login">Login</a>
            <a href="/signup">Sign up</a>
          </nav>
          <p className="tr-footer-copy">© {new Date().getFullYear()} TopRank. Preparation, one mission at a time.</p>
        </div>
      </footer>
    </main>
  );
}
