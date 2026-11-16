"use client";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LogoMark } from "@/components/platform/Logo";

export function Wordmark() { return <Link className="rank-logo" href="/" aria-label="TopRank home"><span className="rank-logo-icon"><LogoMark size={22} /></span>TopRank<span className="rank-logo-dot">®</span></Link>; }
const links = [["/exams", "Exams"], ["/how-it-works", "How it works"], ["/progress-method", "Your progress"], ["/about", "About"]];
export function SiteHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  return <header className="rank-header"><Wordmark /><button className="rank-menu" aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>{open ? "Close ✕" : "Menu ☰"}</button><nav id="public-navigation" className={open ? "is-open" : ""} aria-label="Main navigation">{links.map(([href, label]) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined}>{label}</Link>)}</nav><div className="rank-header-actions"><ThemeToggle /><Link href="/login">Log in</Link><Link className="rank-button small" href="/signup">Start preparing ↗</Link></div></header>;
}
export function SiteFooter() { return <footer className="rank-footer"><div className="rank-footer-top"><div><Wordmark /><p>Big goals. Clear next steps.<br />Your everyday competitive exam workspace.</p><span className="rank-pill">Made for aspirants across India</span></div><div><strong>Explore</strong>{links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</div><div><strong>Your preparation</strong><Link href="/signup">Create your account</Link><Link href="/login">Candidate login</Link><Link href="/recover-account">Account recovery</Link></div><div><strong>Trust & support</strong><Link href="/privacy">Privacy</Link><Link href="/terms">Terms of use</Link><Link href="/guardian-registration">Guardian authorization</Link><Link href="/login/admin">Admin login</Link></div></div><div className="rank-footer-bottom"><span>© {new Date().getFullYear()} TopRank. Keep moving forward.</span><span>Learn. Attempt. Understand. Repeat.</span></div></footer>; }
export function JoinBanner() { return <section className="rank-join" data-reveal><span className="rank-eyebrow">YOUR NEXT CHAPTER</span><h2>Give your ambition<br /><em>a daily place to grow.</em></h2><p>Choose your exams. Find your pace. Make the next study session count.</p><Link href="/signup" className="rank-button lime">Build my preparation plan ↗</Link></section>; }
