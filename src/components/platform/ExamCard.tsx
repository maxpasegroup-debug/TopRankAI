import Link from "next/link";
import type { PublicExam } from "@/server/platform/public";
import { Icon } from "./Icon";

export function ExamCard({ exam }: { exam: PublicExam }) {
  const primaryPart = exam.parts[0] ?? null;
  const paperQuestions = primaryPart?.totalQuestions ?? exam.totalQuestions;
  const paperMinutes = primaryPart?.durationMinutes ?? exam.durationMinutes;
  return (
    <article className="tp-card tp-card-lift tp-exam-card" data-reveal>
      <div className="tp-row-between" style={{ alignItems: "flex-start" }}>
        <span className="tp-pill tp-pill-brand">{exam.category}</span>
        <span className="tp-xs tp-faint">
          {paperMinutes} min · {paperQuestions} Q{exam.parts.length > 1 ? ` · ${exam.parts.length} papers` : ""}
        </span>
      </div>
      <div>
        <h3>{exam.shortName ?? exam.name}</h3>
        {exam.shortName && exam.shortName !== exam.name ? (
          <p className="tp-xs tp-faint" style={{ marginTop: 2 }}>{exam.name}</p>
        ) : null}
      </div>
      <p>{exam.description ?? "Preparation workspace with daily papers, syllabus tracking and analytics."}</p>
      <div className="tp-exam-meta">
        {exam.subjectNames.slice(0, 4).map((subject) => (
          <span className="tp-pill" key={subject}>{subject}</span>
        ))}
        {exam.subjectNames.length > 4 ? <span className="tp-pill">+{exam.subjectNames.length - 4}</span> : null}
      </div>
      <div className="tp-exam-foot">
        <span className="tp-xs tp-muted" title="Daily papers follow this official pattern">
          <b style={{ color: "var(--tp-ink)" }}>{paperQuestions}</b> Q official paper · +{exam.positiveMarks} / −{exam.negativeMarks}
        </span>
        <Link className="tp-btn tp-btn-soft tp-btn-sm" href={`/exams/${exam.code.toLowerCase()}`}>
          Explore <Icon name="arrow-right" size={15} />
        </Link>
      </div>
    </article>
  );
}
