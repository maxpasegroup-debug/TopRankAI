import Link from "next/link";
import { LogoMark } from "./Logo";

const groups = [
  {
    title: "Prepare",
    links: [
      { href: "/exams", label: "Exam catalogue" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/register", label: "Create an account" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/about", label: "About TopRank" },
      { href: "/faq", label: "Questions & answers" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of use" },
      { href: "/privacy", label: "Privacy notice" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-[clamp(56px,8vw,96px)] border-t border-line bg-[color-mix(in_srgb,var(--tp-surface)_60%,transparent)]">
      <div className="mx-auto w-full max-w-page px-[clamp(18px,4vw,34px)]">
        <div className="grid grid-cols-1 gap-10 pt-[clamp(36px,5vw,60px)] pb-7 min-[901px]:grid-cols-2 min-[1081px]:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Link className="tp-brand" href="/" aria-label="TopRank AI home">
              <span className="tp-brand-mark"><LogoMark size={20} /></span>
              <span>TopRank<em>AI</em></span>
            </Link>
            <p className="mt-3.5 max-w-[300px] text-[13px] leading-[1.65] text-muted">
              A daily preparation loop for Indian competitive exams. Real papers, deterministic scoring
              and honest progress — built around your syllabus.
            </p>
            <div className="mt-[18px] flex gap-2">
              <span className="tp-pill tp-pill-brand">Made for India</span>
              <span className="tp-pill">IST scheduling</span>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-3.5 font-sans text-xs font-bold uppercase tracking-[0.12em] text-faint">{group.title}</h4>
              <div className="flex flex-col gap-[9px]">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-sm text-muted transition-colors hover:text-brand">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 pb-8 text-[12.5px] text-faint">
          <span>© {new Date().getFullYear()} TOP RANK AI PRIVATE LIMITED. All rights reserved.</span>
          <span>
            Exam names, patterns and dates belong to their official authorities. Always verify on the official website.
          </span>
        </div>
      </div>
    </footer>
  );
}
