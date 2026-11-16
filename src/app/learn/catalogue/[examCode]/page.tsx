import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/ui/PageContainer";
import { requireRole } from "@/server/auth/session";
import { candidateRoles } from "@/server/auth/roles";
import { listSubjectsForExam } from "@/server/content/service";
import { ValidationApiError } from "@/server/api/errors";

export default async function ExamWorkspacePage({ params }: { params: Promise<{ examCode: string }> }) {
  await requireRole(candidateRoles);
  const { examCode } = await params;
  let data;
  try { data = await listSubjectsForExam(decodeURIComponent(examCode)); }
  catch (error) { if (error instanceof ValidationApiError) notFound(); throw error; }
  return <AppShell currentPath="/learn/catalogue"><PageContainer><main className="journey-shell candidate-exam-workspace">
    <Link className="candidate-back-link" href="/home">← All exam workspaces</Link>
    <div className="candidate-exam-hero"><div><span className="journey-kicker">{data.exam.code} · YOUR WORKSPACE</span><h1>{data.exam.name}</h1><p>Your syllabus and progress for this exam stay separate from your other targets.</p></div><a className="journey-primary" href="/practice">Practice this exam <span>↗</span></a></div>
    <nav className="candidate-workspace-tabs" aria-label={`${data.exam.name} workspace`}><a className="active" href={`/learn/catalogue/${encodeURIComponent(data.exam.code)}`}>Overview</a><a href="/learn">Learn</a><a href="/practice">Practice</a><a href="/progress">Progress</a></nav>
    <section className="candidate-subject-section"><div className="candidate-section-title"><div><span className="journey-kicker">YOUR SYLLABUS</span><h2>Study by subject</h2></div><span>{data.subjects.length} subjects</span></div>
      {data.subjects.length ? <div className="candidate-subject-grid">{data.subjects.map((subject) => <a className="candidate-subject-card" key={subject.code} href={subject.href}><span className="subject-card-icon">{subject.name.slice(0, 1)}</span><strong>{subject.name}</strong><span>Open syllabus ↗</span></a>)}</div> : <div className="candidate-exam-empty"><strong>Syllabus content is being prepared for this exam.</strong><p>We’ll show the subject and topic breakdown here after it has been reviewed and published.</p><a href="/learn/catalogue">Choose another exam ↗</a></div>}
    </section>
    <aside className="candidate-trust-note"><span>ⓘ</span><p>Only published, reviewed learning content appears here. Official exam schedules and scoring rules can change by cycle; check the linked conducting body for current notices.</p></aside>
  </main></PageContainer></AppShell>;
}
