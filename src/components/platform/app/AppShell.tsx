"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon, type IconName } from "../Icon";
import { LogoMark } from "../Logo";
import { ThemeCycle } from "../ThemeCycle";
import { logoutUser } from "@/server/actions/auth";
import { setActiveExam } from "@/server/actions/platform";
import { toast } from "../AppToaster";

export type ShellExam = { code: string; label: string; level: string };

const navGroups: { label: string; items: { href: string; label: string; icon: IconName; exact?: boolean }[] }[] = [
  {
    label: "Prepare",
    items: [
      { href: "/app", label: "Dashboard", icon: "compass", exact: true },
      { href: "/app/daily", label: "Daily exams", icon: "play" },
      { href: "/app/learn", label: "Learning centre", icon: "book" },
      { href: "/app/planner", label: "Planner", icon: "layers" },
    ],
  },
  {
    label: "Progress",
    items: [
      { href: "/app/analytics", label: "Analytics", icon: "chart" },
      { href: "/app/calendar", label: "Calendar", icon: "calendar" },
      { href: "/app/achievements", label: "Achievements", icon: "trophy" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/notifications", label: "Notifications", icon: "bell" },
      { href: "/app/profile", label: "Profile", icon: "user" },
      { href: "/app/exams", label: "My exams", icon: "target" },
    ],
  },
];

export type AppShellProps = {
  user: { name: string; email: string; avatarUrl: string | null };
  exams: ShellExam[];
  activeCode: string | null;
  unread: number;
  children: React.ReactNode;
};

function titleForPath(pathname: string) {
  const all = navGroups.flatMap((group) => group.items);
  const match = all
    .filter((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .sort((left, right) => right.href.length - left.href.length)[0];
  if (match) return match.label;
  if (pathname.includes("/daily/")) return "Daily exam";
  if (pathname.startsWith("/app/learn/")) return "Topic";
  return "Workspace";
}

export function AppShell({ user, exams, activeCode, unread, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function switchExam(code: string) {
    if (code === activeCode) return;
    startTransition(async () => {
      const result = await setActiveExam(code);
      if (!result.ok) toast.error(result.message);
    });
  }

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const title = titleForPath(pathname);

  return (
    <div className="tp-app">
      {open ? <div className="tp-sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <aside className="tp-sidebar" data-open={open}>
        <Link className="tp-brand" href="/" aria-label="TopRank AI home">
          <span className="tp-brand-mark"><LogoMark size={20} /></span>
          <span>TopRank<em>AI</em></span>
        </Link>

        <nav className="tp-side-nav" aria-label="Workspace">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="tp-side-label">{group.label}</div>
              {group.items.map((item) => (
                <Link key={item.href} className="tp-side-link" href={item.href} data-active={isActive(item.href, item.exact)} aria-current={isActive(item.href, item.exact) ? "page" : undefined}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.href === "/app/notifications" && unread > 0 ? <span className="tp-count">{unread > 99 ? "99+" : unread}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="tp-side-foot">
          <div className="tp-row tp-gap-8" style={{ padding: "0 8px 12px" }}>
            <span className="tp-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials || "T"}
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
            {exams.length > 0 ? (
              <label className="tp-exam-switch" title="Active exam">
                <Icon name="target" size={15} />
                <span className="tp-sr">Active exam</span>
                <select value={activeCode ?? exams[0]?.code ?? ""} onChange={(event) => switchExam(event.target.value)} disabled={pending}>
                  {exams.map((exam) => <option key={exam.code} value={exam.code}>{exam.label}</option>)}
                </select>
              </label>
            ) : (
              <Link className="tp-btn tp-btn-sm tp-btn-soft" href="/app/exams">Add an exam</Link>
            )}
            <Link className="tp-theme" href="/app/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} style={{ position: "relative" }}>
              <Icon name="bell" />
              {unread > 0 ? (
                <span style={{ position: "absolute", top: -1, right: -1, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--tp-accent)", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center" }}>
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <ThemeCycle className="tp-theme" />
          </div>
        </div>

        <div className="tp-page" id="main">{children}</div>
      </div>
    </div>
  );
}
