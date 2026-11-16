import { QuestionAdmin, type AdminQuestionRow } from "@/components/platform/admin/QuestionAdmin";
import { listAdminExamOptions, listAdminQuestions, listAdminTopicOptions, listSubjectsAndCategories } from "@/server/admin/platform-admin";
import { toNumber } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question bank" };

export default async function AdminQuestionsPage() {
  const [questions, options, exams, topics] = await Promise.all([
    listAdminQuestions(),
    listSubjectsAndCategories(),
    listAdminExamOptions(),
    listAdminTopicOptions(),
  ]);

  const rows: AdminQuestionRow[] = questions.map((question) => ({
    id: question.id,
    code: question.code,
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    status: question.status,
    reviewStatus: question.reviewStatus,
    active: question.active,
    sourceType: question.sourceType,
    subject: question.subject.name,
    topic: question.topic?.title ?? null,
    marks: toNumber(question.marks),
    negativeMarks: toNumber(question.negativeMarks),
    options: question.options.map((option) => ({ id: option.id, code: option.code, text: option.text, isCorrect: option.isCorrect })),
    exams: question.exams.map((entry) => entry.exam.code),
  }));

  const subjectNames = new Map(options.subjects.map((subject) => [subject.id, subject.name]));

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Content</div>
          <h1>Question bank</h1>
          <p>Author, review and archive the questions that daily papers are drawn from.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill">{questions.length} recent questions</span>
          <span className="tp-pill tp-pill-brand">{rows.filter((row) => row.reviewStatus === "NEEDS_REVIEW").length} need review</span>
        </div>
      </div>

      <QuestionAdmin
        questions={rows}
        subjects={options.subjects.map((subject) => ({ id: subject.id, name: subjectNames.get(subject.id) ?? subject.name }))}
        exams={exams}
        topics={topics}
      />
    </>
  );
}

