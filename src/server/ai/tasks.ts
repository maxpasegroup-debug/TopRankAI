import { z } from "zod";
import { aiConfiguration } from "@/server/env";
import { generateStructured, type AiResult, type GeminiResponseSchema } from "./gemini";

export const generatedQuestionSchema = z.object({
  questions: z.array(z.object({
    text: z.string().min(10).max(4000),
    type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    options: z.array(z.object({ text: z.string().min(1).max(500), correct: z.boolean() })).max(6).default([]),
    numericalAnswer: z.string().max(120).optional(),
    explanation: z.string().min(10).max(4000),
  })).min(1).max(10),
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>["questions"][number];

export const feedbackSchema = z.object({
  headline: z.string().min(3).max(140),
  summary: z.string().min(20).max(900),
  strengths: z.array(z.string().min(3).max(220)).max(5).default([]),
  focusAreas: z.array(z.object({
    topic: z.string().min(2).max(160),
    why: z.string().min(5).max(300),
    action: z.string().min(5).max(300),
  })).max(4).default([]),
  nextSteps: z.array(z.string().min(3).max(220)).max(5).default([]),
});
export type ExamFeedback = z.infer<typeof feedbackSchema>;

export const notesSchema = z.object({
  overview: z.string().min(20).max(2000),
  keyPoints: z.array(z.string().min(3).max(400)).min(2).max(10),
  formulas: z.array(z.string().min(1).max(300)).max(12).default([]),
  workedExample: z.object({ question: z.string().min(5).max(800), solution: z.string().min(5).max(1600) }).nullable(),
  commonMistakes: z.array(z.string().min(3).max(400)).max(6).default([]),
});
export type StudyNotes = z.infer<typeof notesSchema>;

export const planSchema = z.object({
  focus: z.string().min(3).max(200),
  rationale: z.string().min(20).max(800),
  tasks: z.array(z.object({
    title: z.string().min(3).max(160),
    minutes: z.number().int().min(10).max(180),
    kind: z.enum(["LEARN", "PRACTICE", "REVISE"]),
  })).min(2).max(6),
});
export type StudyPlanSuggestion = z.infer<typeof planSchema>;

export const examPatternSchema = z.object({
  parts: z.array(z.object({
    code: z.string().min(1).max(60),
    name: z.string().min(2).max(120),
    description: z.string().max(600).optional(),
    durationMinutes: z.number().int().min(10).max(600),
    totalQuestions: z.number().int().min(1).max(500),
    totalMarks: z.number().min(1).max(2000),
    sections: z.array(z.object({
      name: z.string().min(1).max(120),
      subjectCode: z.string().max(60).optional(),
      questionCount: z.number().int().min(1).max(300),
      mcqCount: z.number().int().min(0).max(300).optional(),
      numericalCount: z.number().int().min(0).max(300).optional(),
      marksPerQuestion: z.number().min(0).max(100),
      negativeMarks: z.number().min(0).max(100),
      note: z.string().max(400).optional(),
    })).min(1).max(20),
    sourceUrl: z.string().max(500).optional(),
  })).min(1).max(6),
  note: z.string().max(1000).optional(),
});
export type GeneratedExamPattern = z.infer<typeof examPatternSchema>;

const JSON_RULE = "Return only a single JSON object. Do not wrap it in markdown. Do not invent exam dates, official ranks, percentages or statistics.";
const SAFETY_RULE = "You are an exam-preparation assistant for Indian competitive exams. Be accurate, concise and encouraging. Never claim a rank, seat or guaranteed outcome.";

/**
 * Gemini rejects schemas that use everything Zod supports, so each task
 * declares the small OpenAPI subset it needs. Optional Zod fields are simply
 * left out of `required`, which Gemini treats as nullable/omittable.
 */
const questionsResponseSchema: GeminiResponseSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          type: { type: "string", enum: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"] },
          difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, correct: { type: "boolean" } },
              required: ["text", "correct"],
            },
          },
          numericalAnswer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["text", "type", "difficulty", "options", "explanation"],
      },
    },
  },
  required: ["questions"],
};

const feedbackResponseSchema: GeminiResponseSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    focusAreas: {
      type: "array",
      items: {
        type: "object",
        properties: { topic: { type: "string" }, why: { type: "string" }, action: { type: "string" } },
        required: ["topic", "why", "action"],
      },
    },
    nextSteps: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "summary", "strengths", "focusAreas", "nextSteps"],
};

const notesResponseSchema: GeminiResponseSchema = {
  type: "object",
  properties: {
    overview: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
    formulas: { type: "array", items: { type: "string" } },
    workedExample: {
      type: "object",
      properties: { question: { type: "string" }, solution: { type: "string" } },
      required: ["question", "solution"],
    },
    commonMistakes: { type: "array", items: { type: "string" } },
  },
  required: ["overview", "keyPoints", "formulas", "workedExample", "commonMistakes"],
};

const planResponseSchema: GeminiResponseSchema = {
  type: "object",
  properties: {
    focus: { type: "string" },
    rationale: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          minutes: { type: "integer" },
          kind: { type: "string", enum: ["LEARN", "PRACTICE", "REVISE"] },
        },
        required: ["title", "minutes", "kind"],
      },
    },
  },
  required: ["focus", "rationale", "tasks"],
};

const examPatternResponseSchema: GeminiResponseSchema = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          durationMinutes: { type: "integer" },
          totalQuestions: { type: "integer" },
          totalMarks: { type: "number" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                subjectCode: { type: "string" },
                questionCount: { type: "integer" },
                mcqCount: { type: "integer" },
                numericalCount: { type: "integer" },
                marksPerQuestion: { type: "number" },
                negativeMarks: { type: "number" },
                note: { type: "string" },
              },
              required: ["name", "questionCount", "marksPerQuestion", "negativeMarks"],
            },
          },
          sourceUrl: { type: "string" },
        },
        required: ["code", "name", "durationMinutes", "totalQuestions", "totalMarks", "sections"],
      },
    },
    note: { type: "string" },
  },
  required: ["parts"],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function textList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\r?\n|;|•/g)
      .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((item) => textList(item));
  const record = asRecord(value);
  if (record) return Object.values(record).flatMap((item) => textList(item));
  return [];
}

/**
 * Gemini occasionally drifts from the requested shape (a string instead of an
 * array, `overview` instead of `summary`, and so on). The platform must never
 * lose a submitted paper to that drift, so this repairs the common variants
 * before Zod validation. It only reshapes data; it never invents scores.
 */
export function normalizeFeedback(value: unknown): unknown {
  const raw = asRecord(value);
  if (!raw) return value;

  const summarySource =
    firstText(raw.summary, raw.overview, raw.analysis, raw.feedback, raw.commentary, raw.message, raw.detail) ??
    textList(raw.strengths).join(" ");

  const strengths = textList(raw.strengths ?? raw.wins ?? raw.positives)
    .map((item) => item.slice(0, 220))
    .filter((item) => item.length >= 3)
    .slice(0, 5);
  const nextSteps = textList(raw.nextSteps ?? raw.next_steps ?? raw.recommendations ?? raw.actions ?? raw.advice)
    .map((item) => item.slice(0, 220))
    .filter((item) => item.length >= 3)
    .slice(0, 5);

  const focusRaw = raw.focusAreas ?? raw.focus_areas ?? raw.weaknesses ?? raw.priorities;
  const focusAreas = (Array.isArray(focusRaw) ? focusRaw : [])
    .map((item) => {
      if (typeof item === "string") {
        return {
          topic: item.slice(0, 160),
          why: "This area limited your accuracy in this paper.",
          action: "Read the topic notes, then retry the related questions.",
        };
      }
      const record = asRecord(item) ?? {};
      return {
        topic: (firstText(record.topic, record.name, record.area, record.title) ?? "Focus area").slice(0, 160),
        why: (firstText(record.why, record.reason, record.detail, record.explanation) ?? "This area limited your accuracy in this paper.").slice(0, 300),
        action: (firstText(record.action, record.advice, record.how, record.next, record.recommendation) ?? "Review the topic notes and retry related questions.").slice(0, 300),
      };
    })
    .slice(0, 4);

  let summary = (summarySource ?? "").slice(0, 900);
  if (summary.length < 20) {
    const parts = [
      strengths.length ? `What worked: ${strengths.join("; ")}.` : "",
      nextSteps.length ? `Next: ${nextSteps.join("; ")}.` : "",
      "Your marks were calculated from your recorded answers; use the section and topic breakdown to choose what to revise next.",
    ].filter(Boolean);
    summary = parts.join(" ").slice(0, 900);
  }

  let headline = firstText(raw.headline, raw.title, raw.heading) ?? (summary.split(/[.!?]/)[0] ?? "");
  headline = headline.slice(0, 140);
  if (headline.length < 3) headline = "Your paper analysis";

  return { headline, summary, strengths, focusAreas, nextSteps };
}

const tolerantFeedbackSchema = z.preprocess(normalizeFeedback, feedbackSchema);

export type QuestionGenerationInput = {
  examName: string;
  subjectName: string;
  topicTitle: string;
  topicDescription: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  count: number;
  userId: string;
  examId: string;
  /** Official syllabus text for the topic, when the catalogue has it. */
  syllabusText?: string | null;
  chapterTitle?: string | null;
  unitTitle?: string | null;
  sourceReferences?: string[];
};

export function generateQuestionDrafts(input: QuestionGenerationInput): Promise<AiResult<GeneratedQuestion[]>> {
  const syllabus = (input.syllabusText ?? "").trim().slice(0, 2_400);
  return generateStructured({
    operation: "generate_questions",
    userId: input.userId,
    examId: input.examId,
    temperature: 0.55,
    maxOutputTokens: 3_200,
    timeoutMs: 45_000,
    schema: generatedQuestionSchema,
    responseSchema: questionsResponseSchema,
    system: `${SAFETY_RULE} You write original practice questions for a question bank. Every question must be solvable from the stated official syllabus, must have exactly one unambiguous answer, and must include a short explanation. Do not copy copyrighted question papers. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName}`,
      input.unitTitle ? `Unit: ${input.unitTitle}` : "",
      input.chapterTitle ? `Chapter: ${input.chapterTitle}` : "",
      `Subject: ${input.subjectName}`,
      `Topic: ${input.topicTitle} — ${input.topicDescription}`,
      syllabus ? `Official syllabus text for this topic:\n${syllabus}` : "",
      input.sourceReferences?.length ? `Official sources: ${input.sourceReferences.join("; ")}` : "",
      `Create ${input.count} ${input.difficulty.toLowerCase()} difficulty questions. Stay strictly inside the syllabus text above.`,
      "Use SINGLE_CHOICE with four options. For NUMERICAL, provide numericalAnswer and no options.",
      "Format: {\"questions\":[{\"text\":\"...\",\"type\":\"SINGLE_CHOICE\",\"difficulty\":\"MEDIUM\",\"options\":[{\"text\":\"...\",\"correct\":true},{\"text\":\"...\",\"correct\":false}],\"explanation\":\"...\"}]}",
    ].filter(Boolean).join("\n"),
  }).then((result) => {
    if (!result.ok) return result;
    const valid = result.data.questions.filter((question) => {
      if (question.type === "NUMERICAL") return Boolean(question.numericalAnswer);
      const correctCount = question.options.filter((option) => option.correct).length;
      return question.options.length >= 2 && (question.type === "SINGLE_CHOICE" ? correctCount === 1 : correctCount >= 1);
    });
    if (!valid.length) return { ok: false as const, code: "INVALID_RESPONSE" as const, message: "The AI returned questions that failed validation. Please try again." };
    return { ...result, data: valid };
  });
}

export type FeedbackInput = {
  examName: string;
  level: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
  scorePercent: number;
  timeTakenSeconds: number;
  durationMinutes: number;
  weakestSubjects: { name: string; accuracy: number }[];
  weakestTopics: { title: string; accuracy: number }[];
  userId: string;
  examId: string;
};

export async function generateExamFeedback(input: FeedbackInput): Promise<{ feedback: ExamFeedback; aiGenerated: boolean }> {
  if (!aiConfiguration().enabled) return { feedback: fallbackFeedback(input), aiGenerated: false };
  const result = await generateStructured({
    operation: "exam_feedback",
    userId: input.userId,
    examId: input.examId,
    temperature: 0.45,
    maxOutputTokens: 1_200,
    timeoutMs: 15_000,
    attempts: 1,
    schema: tolerantFeedbackSchema,
    responseSchema: feedbackResponseSchema,
    system: `${SAFETY_RULE} All marks and percentages have already been calculated by the platform. Do not recalculate or dispute them. Interpret the numbers and give specific, actionable study advice. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName} (${input.level} preparation level)`,
      `Deterministic result: ${input.correct} correct, ${input.incorrect} incorrect, ${input.unanswered} unanswered out of ${input.totalQuestions}.`,
      `Accuracy: ${input.accuracy.toFixed(2)}%. Score: ${input.scorePercent.toFixed(2)}%. Time: ${Math.round(input.timeTakenSeconds / 60)} of ${input.durationMinutes} minutes.`,
      `Weakest subjects: ${input.weakestSubjects.map((s) => `${s.name} (${s.accuracy.toFixed(0)}%)`).join(", ") || "none recorded"}.`,
      `Weakest topics: ${input.weakestTopics.map((t) => `${t.title} (${t.accuracy.toFixed(0)}%)`).join(", ") || "none recorded"}.`,
      "Give feedback that references these exact numbers.",
      "Format: {\"headline\":\"...\",\"summary\":\"...\",\"strengths\":[\"...\"],\"focusAreas\":[{\"topic\":\"...\",\"why\":\"...\",\"action\":\"...\"}],\"nextSteps\":[\"...\"]}",
    ].join("\n"),
  });
  if (!result.ok) return { feedback: fallbackFeedback(input), aiGenerated: false };
  return { feedback: result.data, aiGenerated: true };
}

export function fallbackFeedback(input: FeedbackInput): ExamFeedback {
  const strength = input.correct > 0
    ? `You answered ${input.correct} of ${input.totalQuestions} questions correctly with ${input.accuracy.toFixed(0)}% accuracy.`
    : "You completed the paper and generated useful data about where to begin.";
  const focus = input.weakestTopics[0]?.title ?? input.weakestSubjects[0]?.name ?? "your most recent topic";
  const nextSteps = [
    input.unanswered > 0 ? `Attempt every question next time; ${input.unanswered} were left unanswered.` : "Keep your attempt rate high and review every incorrect answer.",
    `Revisit ${focus} in the learning centre before your next daily exam.`,
    "Read each explanation, then add the missed idea to revision.",
  ];
  return {
    headline: input.accuracy >= 70 ? "A solid paper with clear next steps" : "A useful diagnostic paper",
    summary: `${strength} AI commentary is unavailable right now, so this feedback is generated from your recorded answers. Act on these deterministic observations and retry later for a deeper narrative.`,
    strengths: input.correct > 0 ? [`${input.correct} correct answers`, `${input.accuracy.toFixed(0)}% accuracy`] : [],
    focusAreas: input.weakestTopics.slice(0, 3).map((topic) => ({
      topic: topic.title,
      why: `Accuracy on this topic was ${topic.accuracy.toFixed(0)}% in this paper.`,
      action: "Read the topic notes, then redo the related questions from the explanation view.",
    })),
    nextSteps,
  };
}

export type NotesInput = {
  examName: string;
  subjectName: string;
  topicTitle: string;
  topicDescription: string;
  userId: string;
  examId: string;
  syllabusText?: string | null;
};

export function generateStudyNotes(input: NotesInput): Promise<AiResult<StudyNotes>> {
  const syllabus = (input.syllabusText ?? "").trim().slice(0, 2_000);
  return generateStructured({
    operation: "study_notes",
    userId: input.userId,
    examId: input.examId,
    temperature: 0.35,
    maxOutputTokens: 2_600,
    timeoutMs: 45_000,
    schema: notesSchema,
    responseSchema: notesResponseSchema,
    system: `${SAFETY_RULE} You write concise, curriculum-aligned study notes for an Indian entrance exam. Keep facts correct. If a fact is uncertain, omit it. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName}`,
      `Subject: ${input.subjectName}`,
      `Topic: ${input.topicTitle}`,
      `Scope: ${input.topicDescription}`,
      syllabus ? `Official syllabus text:\n${syllabus}` : "",
      "Write: a short overview, 4-7 key points, formulas if relevant, one worked example with its solution, and common mistakes.",
      "Format: {\"overview\":\"...\",\"keyPoints\":[\"...\"],\"formulas\":[\"...\"],\"workedExample\":{\"question\":\"...\",\"solution\":\"...\"},\"commonMistakes\":[\"...\"]}",
    ].filter(Boolean).join("\n"),
  });
}

export type PlanInput = {
  examName: string;
  level: string;
  daysToExam: number | null;
  dailyMinutes: number;
  weakTopics: string[];
  userId: string;
  examId: string;
};

export async function suggestStudyPlan(input: PlanInput): Promise<{ plan: StudyPlanSuggestion; aiGenerated: boolean }> {
  if (!aiConfiguration().enabled) return { plan: fallbackPlan(input), aiGenerated: false };
  const result = await generateStructured({
    operation: "study_plan",
    userId: input.userId,
    examId: input.examId,
    temperature: 0.5,
    maxOutputTokens: 1_500,
    timeoutMs: 25_000,
    schema: planSchema,
    responseSchema: planResponseSchema,
    system: `${SAFETY_RULE} Suggest a realistic day of study. Do not reference exam dates you were not given. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName}`,
      `Preparation level: ${input.level}`,
      `Study time available today: ${input.dailyMinutes} minutes`,
      `Days to target date: ${input.daysToExam ?? "not set"}`,
      `Weak topics: ${input.weakTopics.join(", ") || "not enough data yet"}`,
      "Return 2-5 tasks whose total minutes fit the available time.",
    ].join("\n"),
  });
  if (!result.ok) return { plan: fallbackPlan(input), aiGenerated: false };
  return { plan: result.data, aiGenerated: true };
}

export type ExamPatternInput = {
  examName: string;
  officialUrl: string | null;
  notes?: string;
  userId: string;
  examId: string;
};

export function generateExamPattern(input: ExamPatternInput): Promise<AiResult<GeneratedExamPattern>> {
  return generateStructured({
    operation: "generate_exam_pattern",
    userId: input.userId,
    examId: input.examId,
    temperature: 0.2,
    maxOutputTokens: 3_000,
    timeoutMs: 45_000,
    schema: examPatternSchema,
    responseSchema: examPatternResponseSchema,
    system: `${SAFETY_RULE} You document objective exam paper structures. Do not invent dates, cut-offs, ranks or eligibility claims. Return a structure that a human can verify against the official source. Never mark a pattern as verified. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName}`,
      `Official website: ${input.officialUrl ?? "not provided"}`,
      input.notes ? `Editor notes: ${input.notes}` : "",
      "Return the current publicly known paper structure.",
      "If the exam has multiple papers or stages, return one part per paper.",
      "Include section-wise question counts, MCQ/numerical split where known, marks per question and negative marking.",
      "Use subjectCode only from: PHYSICS, CHEMISTRY, BIOLOGY, MATHEMATICS, ENGLISH, LOGICAL_REASONING, QUANTITATIVE_APTITUDE, GENERAL_AWARENESS, LEGAL_REASONING, DESIGN_APTITUDE, COMPUTER_AWARENESS, ENGINEERING_MATHEMATICS.",
      'Format: {"parts":[{"code":"PAPER_1","name":"Paper 1","durationMinutes":180,"totalQuestions":75,"totalMarks":300,"sections":[{"name":"Physics","subjectCode":"PHYSICS","questionCount":25,"mcqCount":20,"numericalCount":5,"marksPerQuestion":4,"negativeMarks":1}]}],"note":"..."}',
    ].filter(Boolean).join("\n"),
  });
}

export function fallbackPlan(input: PlanInput): StudyPlanSuggestion {
  const focus = input.weakTopics[0] ?? "a core syllabus topic";
  const half = Math.max(15, Math.round(input.dailyMinutes * 0.55));
  const rest = Math.max(10, input.dailyMinutes - half);
  return {
    focus,
    rationale: `A balanced session: ${half} minutes learning ${focus} and ${rest} minutes practising and reviewing. This plan uses your recorded weak topics and available time, without AI.`,
    tasks: [
      { title: `Study ${focus}`, minutes: half, kind: "LEARN" },
      { title: "Daily exam and explanation review", minutes: rest, kind: "PRACTICE" },
    ],
  };
}
