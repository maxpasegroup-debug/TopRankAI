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
  // separate console at /login/admin that is not linked from public pages.
  const workspace = user && user.role !== "PLATFORM_ADMIN" ? "/app" : null;

  return (
    <header className="sticky top-0 z-[80] border-b border-[color-mix(in_srgb,var(--tp-line)_70%,transparent)] bg-[color-mix(in_srgb,var(--tp-bg)_78%,transparent)] backdrop-blur-[18px] backdrop-saturate-[1.3]">
      <div className="mx-auto flex min-h-[var(--tp-header-h)] w-full max-w-page items-center gap-[18px] px-[clamp(18px,4vw,34px)] max-[380px]:gap-1.5">
        <Link className="tp-brand" href="/" aria-label="TopRank AI home">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>

        <nav className="ml-2.5 hidden items-center gap-0.5 min-[900px]:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-[13px] py-2 text-sm font-[550] text-muted transition-colors hover:bg-surface-3 hover:text-ink data-[active=true]:bg-surface-3 data-[active=true]:text-ink"
              data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 max-[380px]:gap-1">
          <ThemeCycle />
          {workspace ? (
            <Link className="tp-btn tp-btn-sm tp-workspace-link" href={workspace}>My workspace</Link>
          ) : (
            <>
              <Link className="tp-btn tp-btn-ghost tp-btn-sm hidden min-[641px]:inline-flex" href="/login">Sign in</Link>
              <Link className="tp-btn tp-btn-sm hidden min-[641px]:inline-flex" href="/register">Start preparing</Link>
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

      <div className="mx-auto w-full max-w-page px-[clamp(18px,4vw,34px)] min-[900px]:hidden">
        <nav
          className={`${open ? "flex" : "hidden"} flex-col gap-1 border-t border-line pb-5 pt-3`}
          id="tp-mobile-nav"
          data-open={open}
          aria-label="Mobile"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm px-3.5 py-3 font-semibold text-muted hover:bg-surface-3 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          {workspace ? (
            <Link className="rounded-sm px-3.5 py-3 font-semibold text-muted hover:bg-surface-3 hover:text-ink" href={workspace}>My workspace</Link>
          ) : (
            <>
              <Link className="rounded-sm px-3.5 py-3 font-semibold text-muted hover:bg-surface-3 hover:text-ink" href="/login">Sign in</Link>
              <Link className="rounded-sm px-3.5 py-3 font-semibold text-muted hover:bg-surface-3 hover:text-ink" href="/register">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
