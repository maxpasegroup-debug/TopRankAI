import { ExamPlanEditor } from "@/components/platform/app/ExamPlanEditor";
import { requireAuth } from "@/server/auth/session";
import { getCandidateExams } from "@/server/platform/candidate";
import { getRegistrationOptions } from "@/server/platform/public";

export const dynamic = "force-dynamic";
export const metadata = { title: "My exams" };

export default async function ExamPlanPage() {
  const user = await requireAuth();
  const [exams, groups] = await Promise.all([getCandidateExams(user.id), getRegistrationOptions()]);

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">Preparation plan</div>
          <h1>My exams</h1>
          <p>Keep more than one pathway if you are preparing in parallel. Every exam keeps its own level, target year and daily time.</p>
        </div>
      </div>

      <ExamPlanEditor
        groups={groups}
        currentYear={new Date().getFullYear()}
        initial={exams.map((exam) => ({
          examId: exam.examId,
          examName: exam.name,
          partCode: exam.part?.code,
          level: exam.level,
          targetYear: exam.targetYear,
          dailyMinutes: exam.dailyMinutes,
        }))}
      />
    </>
  );
}
