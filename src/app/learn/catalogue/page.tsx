import Link from "next/link";
import { requireRole } from "@/server/auth/session";
import { candidateRoles } from "@/server/auth/roles";
import { listPublishedExams } from "@/server/content/service";
import { AppShell } from "@/components/layout/AppShell";
import { Motion } from "@/components/experience/Motion";
export default async function Page() {
  await requireRole(candidateRoles); const exams = await listPublishedExams();
  return <AppShell currentPath="/learn/catalogue"><Motion className="rank-dashboard"><div className="rank-dashboard-heading"><div><span className="rank-eyebrow">GIVE EVERY GOAL ITS OWN SPACE</span><h1>Your exam workspace</h1><p>Explore published preparation material, then make a target part of your daily plan.</p></div><Link href="/onboarding" className="rank-button small">Manage my targets ↗</Link></div><div className="rank-category-grid">{exams.map((exam, index) => <Link className="rank-category" key={exam.code} href={`/learn/catalogue/${encodeURIComponent(exam.code)}`} data-reveal><span className={`rank-category-icon ${["mint", "lavender", "yellow"][index % 3]}`}>↗</span><h3>{exam.name}</h3><p>Open the published subjects and learning material for this exam.</p><span>Explore syllabus →</span></Link>)}</div>{!exams.length && <div className="rank-empty"><h3>Preparation material is on its way.</h3><p>Published exams will appear here as their content is reviewed.</p></div>}<div className="rank-coverage"><strong>Looking for another exam?</strong><p>The wider catalogue is visible during onboarding. Listed exams under review do not yet have published preparation content.</p></div></Motion></AppShell>;
}
