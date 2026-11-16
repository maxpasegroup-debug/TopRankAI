export type PatternSection = {
  name: string;
  subjectCode?: string;
  questionCount: number;
  mcqCount?: number;
  numericalCount?: number;
  marksPerQuestion: number;
  negativeMarks: number;
  totalMarks?: number;
  note?: string;
};

export type PatternPart = {
  code: string;
  name: string;
  description?: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  sections: PatternSection[];
  verified: boolean;
  sourceUrl?: string;
};

export type ExamPattern = {
  parts: PatternPart[];
  note?: string;
};

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readExamPattern(value: unknown): ExamPattern | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { parts?: unknown; note?: unknown };
  if (!Array.isArray(raw.parts)) return null;
  const parts: PatternPart[] = [];
  for (const entry of raw.parts) {
    if (!entry || typeof entry !== "object") continue;
    const part = entry as Record<string, unknown>;
    if (typeof part.code !== "string" || typeof part.name !== "string") continue;
    const sections: PatternSection[] = Array.isArray(part.sections)
      ? part.sections.flatMap((section) => {
          if (!section || typeof section !== "object") return [];
          const row = section as Record<string, unknown>;
          if (typeof row.name !== "string") return [];
          return [{
            name: row.name,
            subjectCode: typeof row.subjectCode === "string" ? row.subjectCode : undefined,
            questionCount: asNumber(row.questionCount),
            mcqCount: typeof row.mcqCount === "number" ? row.mcqCount : undefined,
            numericalCount: typeof row.numericalCount === "number" ? row.numericalCount : undefined,
            marksPerQuestion: asNumber(row.marksPerQuestion),
            negativeMarks: asNumber(row.negativeMarks),
            totalMarks: typeof row.totalMarks === "number" ? row.totalMarks : undefined,
            note: typeof row.note === "string" ? row.note : undefined,
          }];
        })
      : [];
    parts.push({
      code: part.code,
      name: part.name,
      description: typeof part.description === "string" ? part.description : undefined,
      durationMinutes: asNumber(part.durationMinutes),
      totalQuestions: asNumber(part.totalQuestions),
      totalMarks: asNumber(part.totalMarks),
      sections,
      verified: part.verified === true,
      sourceUrl: typeof part.sourceUrl === "string" ? part.sourceUrl : undefined,
    });
  }
  if (!parts.length) return null;
  return { parts, note: typeof raw.note === "string" ? raw.note : undefined };
}

export function findExamPart(pattern: ExamPattern | null, code?: string | null): PatternPart | null {
  if (!pattern?.parts.length) return null;
  if (!code) return pattern.parts[0];
  return pattern.parts.find((part) => part.code === code) ?? pattern.parts[0];
}

export function partLabel(part: PatternPart | null | undefined) {
  return part ? part.name : "Official pattern";
}

export function sectionMarkLabel(section: PatternSection) {
  if (typeof section.totalMarks === "number" && section.totalMarks > 0) {
    return `${section.totalMarks} marks`;
  }
  if (section.marksPerQuestion > 0) {
    return `+${section.marksPerQuestion} / −${section.negativeMarks}`;
  }
  return "variable marking";
}

export function sectionRange(section: PatternSection) {
  const parts: string[] = [];
  if (section.mcqCount) parts.push(`${section.mcqCount} MCQ`);
  if (section.numericalCount) parts.push(`${section.numericalCount} numerical`);
  return parts.length ? parts.join(" + ") : `${section.questionCount} questions`;
}
