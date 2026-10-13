import Link from "next/link";
import { requireRole } from "@/server/auth/session";
import { listPublishedExams } from "@/server/content/service";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/ui/PageContainer";
export default async function Page() {
  await requireRole(["STUDENT"]); const exams = await listPublishedExams();
  return <AppShell currentPath="/learn"><PageContainer><main className="journey-shell"><nav><Link href="/learn">Learning</Link></nav><h1>Exam catalogue</h1>
    {exams.length ? <ul className="journey-task-list">{exams.map(exam => <li key={exam.code}><strong>{exam.name}</strong><Link href={`/learn/catalogue/${encodeURIComponent(exam.code)}`}>Subjects</Link></li>)}</ul> : <p>No published exams yet.</p>}
  </main></PageContainer></AppShell>;
}
