import { CandidateAdmin, type AdminCandidateRow } from "@/components/platform/admin/CandidateAdmin";
import { listAdminCandidates } from "@/server/admin/platform-admin";
import { formatDate, levelLabel } from "@/server/platform/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates" };

export default async function AdminCandidatesPage() {
  const candidates = await listAdminCandidates();

  const rows: AdminCandidateRow[] = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    location: [candidate.city, candidate.state].filter(Boolean).join(", ") || null,
    status: candidate.status,
    joinedLabel: formatDate(candidate.createdAt, { day: "numeric", month: "short", year: "numeric" }),
    lastActiveLabel: candidate.lastActiveAt ? formatDate(candidate.lastActiveAt, { day: "numeric", month: "short" }) : "Never",
    onboarded: Boolean(candidate.onboardingCompletedAt),
    attempts: candidate._count.examAttempts,
    exams: candidate.candidateExamTargets.map((target) => ({ code: target.exam.code, name: target.exam.name, level: levelLabel(target.preparationLevel) })),
  }));

  return (
    <>
      <div className="tp-page-head">
        <div>
          <div className="tp-eyebrow">People</div>
          <h1>Candidates</h1>
          <p>Inspect preparation plans and suspend abusive accounts. Personal data is shown only to platform administrators.</p>
        </div>
        <div className="tp-row tp-gap-8 tp-wrap">
          <span className="tp-pill">{rows.filter((row) => row.status === "ACTIVE").length} active</span>
          <span className="tp-pill tp-pill-brand">{rows.filter((row) => row.onboarded).length} onboarded</span>
        </div>
      </div>

      <CandidateAdmin candidates={rows} />
    </>
  );
}

