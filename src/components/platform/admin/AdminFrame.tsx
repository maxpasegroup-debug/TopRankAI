"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "../Icon";
import { LogoMark } from "../Logo";
import { ThemeCycle } from "../ThemeCycle";
import { logoutUser } from "@/server/actions/auth";

const navGroups: { label: string; items: { href: string; label: string; icon: IconName; exact?: boolean }[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Overview", icon: "compass", exact: true },
      { href: "/admin/exams", label: "Exams", icon: "target" },
      { href: "/admin/questions", label: "Question bank", icon: "layers" },
      { href: "/admin/syllabus", label: "Syllabus", icon: "book" },
      { href: "/admin/calendar", label: "Exam calendar", icon: "calendar" },
    ],
  },
  {
    label: "People & AI",
    items: [
      { href: "/admin/candidates", label: "Candidates", icon: "user" },
      { href: "/admin/ai", label: "AI operations", icon: "cpu" },
    ],
  },
];

const titles: Record<string, string> = {
  "/admin": "Platform overview",
  "/admin/exams": "Exam catalogue",
  "/admin/questions": "Question bank",
  "/admin/syllabus": "Syllabus library",
  "/admin/calendar": "Exam calendar",
  "/admin/candidates": "Candidates",
  "/admin/ai": "AI operations",
};

export type AdminFrameProps = {
  user: { name: string; email: string; avatarUrl: string | null };
  children: React.ReactNode;
};

export function AdminFrame({ user, children }: AdminFrameProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const title = titles[pathname] ?? "Administration";
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="tp-app">
      {open ? <div className="tp-sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <aside className="tp-sidebar" data-open={open}>
        <Link className="tp-brand" href="/admin" aria-label="TopRank AI administration">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>
        <div className="tp-pill tp-pill-brand" style={{ margin: "0 10px 14px", width: "fit-content" }}>
          Administration
        </div>

        <nav className="tp-side-nav" aria-label="Administration">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="tp-side-label">{group.label}</div>
              {group.items.map((item) => (
                <Link key={item.href} className="tp-side-link" href={item.href} data-active={isActive(item.href, item.exact)} aria-current={isActive(item.href, item.exact) ? "page" : undefined}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
          <div>
            <div className="tp-side-label">Platform</div>
            <Link className="tp-side-link" href="/" target="_blank" rel="noopener noreferrer">
              <Icon name="eye" />
              <span>View public site</span>
            </Link>
            <Link className="tp-side-link" href="/app">
              <Icon name="compass" />
              <span>Candidate app</span>
            </Link>
          </div>
        </nav>

        <div className="tp-side-foot">
          <div className="tp-row tp-gap-8" style={{ padding: "0 8px 12px" }}>
            <span className="tp-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials || "A"}
            </span>
            <div className="tp-grow" style={{ minWidth: 0 }}>
              <div className="tp-small" style={{ fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div className="tp-xs tp-faint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
          </div>
          <form action={logoutUser}>
            <button className="tp-side-link" type="submit" style={{ width: "100%", border: 0, background: "transparent", cursor: "pointer" }}>
              <Icon name="logout" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="tp-main">
        <div className="tp-topbar">
          <button type="button" className="tp-menu-btn tp-mobile-bar" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <span className="tp-topbar-title">{title}</span>
          <div className="tp-topbar-actions">
            <span className="tp-pill" style={{ whiteSpace: "nowrap" }}><Icon name="shield" size={13} /> Admin</span>
            <ThemeCycle className="tp-theme" />
          </div>
        </div>
        <div className="tp-page" id="main">{children}</div>
      </div>
    </div>
  );
}
