"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";
import { ThemeCycle } from "./ThemeCycle";

const links = [
  { href: "/exams", label: "Exams" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export type HeaderUser = { name: string; role: string } | null;

export function SiteHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The public site deliberately stays public for administrators. They have a
  // separate console at /login/admin and a footer link to reach it.
  const workspace = user && user.role !== "PLATFORM_ADMIN" ? "/app" : null;

  return (
    <header className="tp-header">
      <div className="tp-shell tp-header-inner">
        <Link className="tp-brand" href="/" aria-label="TopRank AI home">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>

        <nav className="tp-nav" aria-label="Main">
          {links.map((link) => (
            <Link key={link.href} href={link.href} data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="tp-header-actions">
          <ThemeCycle />
          {workspace ? (
            <Link className="tp-btn tp-btn-sm tp-workspace-link" href={workspace}>My workspace</Link>
          ) : (
            <>
              {!user && <Link className="tp-btn tp-btn-ghost tp-btn-sm tp-workspace-link" href="/login">My workspace</Link>}
              <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/login">Sign in</Link>
              <Link className="tp-btn tp-btn-sm" href="/register">Start preparing</Link>
            </>
          )}
          <button
            type="button"
            className="tp-menu-btn"
            aria-expanded={open}
            aria-controls="tp-mobile-nav"
            aria-label="Toggle navigation"
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>

      <div className="tp-shell">
        <nav className="tp-mobile-nav" id="tp-mobile-nav" data-open={open} aria-label="Mobile">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
          {workspace ? (
            <Link href={workspace}>My workspace</Link>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/register">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
