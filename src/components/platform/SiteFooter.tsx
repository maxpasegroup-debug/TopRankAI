import Link from "next/link";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="tp-footer">
      <div className="tp-shell">
        <div className="tp-footer-inner">
          <div>
            <Link className="tp-brand" href="/" aria-label="TopRank AI home">
              <span className="tp-brand-mark"><LogoMark size={20} /></span>
              <span>TopRank<em>AI</em></span>
            </Link>
            <p className="tp-small tp-muted" style={{ marginTop: 14, maxWidth: 300, lineHeight: 1.65 }}>
              A daily preparation loop for Indian competitive exams. Real papers, deterministic scoring
              and honest progress — built around your syllabus.
            </p>
            <div className="tp-row tp-gap-8" style={{ marginTop: 18 }}>
              <span className="tp-pill tp-pill-brand">Made for India</span>
              <span className="tp-pill">IST scheduling</span>
            </div>
          </div>

          <div>
            <h4>Prepare</h4>
            <div className="tp-footer-links">
              <Link href="/exams">Exam catalogue</Link>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/register">Create an account</Link>
              <Link href="/login">Sign in</Link>
            </div>
          </div>

          <div>
            <h4>Platform</h4>
            <div className="tp-footer-links">
              <Link href="/about">About TopRank</Link>
              <Link href="/faq">Questions &amp; answers</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>

          <div>
            <h4>Legal</h4>
            <div className="tp-footer-links">
              <Link href="/terms">Terms of use</Link>
              <Link href="/privacy">Privacy notice</Link>
              <Link href="/login/admin">Administrator sign in</Link>
            </div>
          </div>
        </div>

        <div className="tp-footer-bottom">
          <span>© {new Date().getFullYear()} TOP RANK AI PRIVATE LIMITED. All rights reserved.</span>
          <span>
            Exam names, patterns and dates belong to their official authorities. Always verify on the official website.
          </span>
        </div>
      </div>
    </footer>
  );
}
