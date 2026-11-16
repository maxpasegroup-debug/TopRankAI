import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/experience/SiteChrome";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const navigation = [["/home", "⌂", "Today"], ["/learn/catalogue", "◈", "My exams"], ["/learn", "▤", "Learn"], ["/practice", "✎", "Practice"], ["/progress", "↗", "Progress"], ["/me", "○", "My account"]];
export function AppShell({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  return <div className="rank rank-workspace"><aside className="rank-workspace-sidebar"><Wordmark /><small>YOUR PREPARATION SPACE</small><nav className="rank-workspace-nav" aria-label="Candidate navigation">{navigation.map(([href, icon, label]) => <Link key={href} href={href} className={currentPath === href ? "active" : ""} aria-current={currentPath === href ? "page" : undefined}><span aria-hidden="true">{icon}</span><span>{label}</span></Link>)}</nav><div className="rank-workspace-tip"><span>✳ A little, every day.</span><p>A useful study session ends with one thing you understand better.</p><Link href="/get-help">Find your next step ↗</Link></div><div className="rank-workspace-tools"><Link href="/settings">Settings</Link><ThemeToggle /></div></aside><div className="rank-workspace-main"><header className="rank-workspace-bar"><span>MY WORKSPACE <span aria-hidden="true"> / </span> <strong>{navigation.find(([href]) => href === currentPath)?.[2] ?? "Preparation"}</strong></span><Link href="/onboarding">Manage exam goals ↗</Link></header>{children}</div></div>;
}
