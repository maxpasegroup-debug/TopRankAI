import Link from "next/link";
import { requireRole } from "@/server/auth/session";
import { listSubjectsForExam } from "@/server/content/service";
import { codeParamSchema } from "@/server/content/validation";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/ui/PageContainer";
export default async function Page({ params }: { params: Promise<{ examCode: string }> }) {
  await requireRole(["STUDENT"]); const { examCode } = codeParamSchema.parse(await params); const data = await listSubjectsForExam(examCode);
  return <AppShell currentPath="/learn"><PageContainer><main className="journey-shell"><nav><Link href="/learn/catalogue">Exam catalogue</Link></nav><h1>{data.exam.name}</h1>
    {data.subjects.length ? <ul className="journey-task-list">{data.subjects.map(subject => <li key={subject.slug}><strong>{subject.name}</strong><Link href={subject.href}>Chapters</Link></li>)}</ul> : <p>No published subjects yet.</p>}
  </main></PageContainer></AppShell>;
}
