import { ExamAdmin, type AdminExamRow } from "@/components/platform/admin/ExamAdmin";
import { listAdminExams, listSubjectsAndCategories } from "@/server/admin/platform-admin";
import { toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exam catalogue" };

export default async function AdminExamsPage() {
  const [exams, options] = await Promise.all([listAdminExams(), listSubjectsAndCategories()]);

  const rows: AdminExamRow[] = exams.map((exam) => ({
    id: exam.id,
    code: exam.code,
    name: exam.name,
    shortName: exam.shortName,
    category: exam.examCategory?.name ?? exam.category ?? null,
    description: exam.description,
    officialUrl: exam.officialUrl,
    active: exam.active,
    durationMinutes: exam.configuration?.durationMinutes ?? 60,
    totalQuestions: exam.configuration?.totalQuestions ?? 30,
    dailyTestQuestions: exam.configuration?.dailyTestQuestions ?? 8,
    dailyTestMinutes: exam.configuration?.dailyTestMinutes ?? 12,
    positiveMarks: toNumber(exam.configuration?.positiveMarks ?? 4),
    negativeMarks: toNumber(exam.configuration?.negativeMarks ?? 1),
    markingNote: exam.configuration?.markingNote ?? null,
    subjectCount: exam._count.examSubjects,
    questionCount: exam._count.questionExams,
    candidateCount: exam._count.candidateTargets,
    dailyCount: exam._count.dailyExams,
    subjects: exam.examSubjects.map((entry) => entry.subject.name),
  }));

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Content</div>
          <h1>Exam catalogue</h1>
          <p>Each exam carries its own paper model. Marks are calculated on the server from this configuration.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill">{exams.filter((exam) => exam.active).length} active</span>
          <span className="tp-pill tp-pill-brand">{options.subjects.length} subjects</span>
        </div>
      </div>

      <ExamAdmin exams={rows} subjects={options.subjects} categories={options.categories} />
    </>
  );
}

