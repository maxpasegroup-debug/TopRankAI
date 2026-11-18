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

/**
 * Batch-authoring contract for full-length papers. Unlike the interactive
 * draft task this asks for a fixed four-option MCQ with an explicit zero-based
 * correct index, which is what a paper needs to score deterministically.
 */
export const paperQuestionSchema = z.object({
  questions: z.array(z.object({
    topic: z.string().min(2).max(160),
    text: z.string().min(15).max(4000),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    options: z.array(z.string().min(1).max(600)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(20).max(4000),
  })).min(1).max(20),
});
export type PaperQuestion = z.infer<typeof paperQuestionSchema>["questions"][number];

/**
 * Batch notes contract. One call covers a small group of topics from the same
 * chapter so the model can write detailed, grounded notes without one request
 * per topic. The content is stored as a StudyMaterial row, never as a claim
 * that it came from a textbook.
 */
export const topicNotesBatchSchema = z.object({
  notes: z.array(z.object({
    topic: z.string().min(2).max(160),
    overview: z.string().min(120).max(2000),
    keyPoints: z.array(z.string().min(3).max(320)).min(3).max(8),
    formulas: z.array(z.string().min(1).max(320)).max(8).default([]),
    workedExample: z.object({
      question: z.string().min(8).max(900),
      solution: z.string().min(20).max(1600),
    }).nullable(),
    commonMistakes: z.array(z.string().min(3).max(320)).max(5).default([]),
  })).min(1).max(8),
});
export type TopicNote = z.infer<typeof topicNotesBatchSchema>["notes"][number];

const topicNotesResponseSchema: GeminiResponseSchema = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
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
        required: ["topic", "overview", "keyPoints", "formulas", "workedExample", "commonMistakes"],
      },
    },
  },
  required: ["notes"],
};

export type TopicNotesInput = {
  examName: string;
  subjectName: string;
  chapterTitle: string;
  topics: { title: string; description: string; syllabusText: string }[];
  examId: string;
  model?: string;
};

export function generateTopicNotesBatch(input: TopicNotesInput): Promise<AiResult<TopicNote[]>> {
  const topicBlock = input.topics
    .map(
      (topic, index) =>
        `${index + 1}. ${topic.title}\nDescription: ${topic.description || "No extra description."}\nOfficial syllabus passage: ${(topic.syllabusText || "No matching passage; stay inside the title.").slice(0, 1_800)}`,
    )
    .join("\n\n");
  return generateStructured({
    operation: "generate_topic_notes",
    examId: input.examId,
    model: input.model,
    temperature: 0.35,
    maxOutputTokens: 8_192,
    timeoutMs: 150_000,
    attempts: 1,
    schema: topicNotesBatchSchema,
    responseSchema: topicNotesResponseSchema,
    system: `${SAFETY_RULE} You are writing original study notes for an Indian competitive exam. Use only the supplied official syllabus passage and the topic title. Do not quote textbooks, invent previous-year questions, or claim an official citation. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName}`,
      `Subject: ${input.subjectName}`,
      `Chapter: ${input.chapterTitle}`,
      `Write one detailed note per topic below.`,
      topicBlock,
      "For each topic return the topic title exactly as given.",
      "The overview must be at least 150 words, teach the concept rather than repeat the syllabus, and define every symbol used.",
      "Key points must be specific and exam-oriented. Formulas must include the meaning of each variable and its unit where applicable.",
      "The worked example must be a new, solvable example with a full step-by-step solution; never label it as a previous-year question.",
      "Common mistakes should name the exact error a student is likely to make.",
      "Use plain text with short paragraphs and bullet points. Do not use HTML.",
      "Format: {\"notes\":[{\"topic\":\"...\",\"overview\":\"...\",\"keyPoints\":[\"...\"],\"formulas\":[\"...\"],\"workedExample\":{\"question\":\"...\",\"solution\":\"...\"},\"commonMistakes\":[\"...\"]}]}",
    ].join("\n"),
  }).then((result) => {
    if (!result.ok) return result;
    const valid = result.data.notes.filter(
      (note) => note.overview.trim().length >= 120 && note.keyPoints.length >= 3,
    );
    if (!valid.length) {
      return {
        ok: false as const,
        code: "INVALID_RESPONSE" as const,
        message: "The AI returned notes that failed validation. Please try again.",
      };
    }
    return { ...result, data: valid };
  });
}

const paperQuestionsResponseSchema: GeminiResponseSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          text: { type: "string" },
          difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["topic", "text", "difficulty", "options", "correctIndex", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export type PaperQuestionInput = {
  examName: string;
  sectionName: string;
  subjectName: string;
  /** Topic titles with their curated descriptions, one per line. */
  topics: string;
  /** Quoted official syllabus passages that anchor the batch. */
  syllabusText: string;
  count: number;
  examId: string;
  userId?: string | null;
  sourceReferences?: string[];
  /** Stems already in the bank, so the model does not reproduce them. */
  avoidStems?: string[];
  model?: string;
};

/**
 * Writes a batch of paper questions grounded in the official syllabus text.
 * Structural validation happens in the caller; this only guarantees the shape.
 */
export function generatePaperQuestions(
  input: PaperQuestionInput,
): Promise<AiResult<PaperQuestion[]>> {
  const syllabus = input.syllabusText.trim().slice(0, 6_000);
  const avoid = (input.avoidStems ?? []).slice(0, 12).map((stem) => `- ${stem.slice(0, 140)}`);
  return generateStructured({
    operation: "generate_paper_questions",
    userId: input.userId ?? null,
    examId: input.examId,
    model: input.model,
    temperature: 0.72,
    maxOutputTokens: 8_192,
    timeoutMs: 120_000,
    attempts: 1,
    schema: paperQuestionSchema,
    responseSchema: paperQuestionsResponseSchema,
    system: `${SAFETY_RULE} You are a subject examiner writing an original mock paper for an Indian competitive exam. Questions must be answerable from the stated official syllabus, must have exactly one unambiguously correct option, and must not copy an existing question paper. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName}`,
      `Section: ${input.sectionName}`,
      `Subject: ${input.subjectName}`,
      `Topics allowed in this batch:\n${input.topics}`,
      syllabus ? `Official syllabus passages:\n${syllabus}` : "",
      input.sourceReferences?.length ? `Official source(s): ${input.sourceReferences.join("; ")}` : "",
      avoid.length ? `Do not repeat or lightly reword any of these existing questions:\n${avoid.join("\n")}` : "",
      `Write ${input.count} single-correct multiple-choice questions. Spread them across the allowed topics and vary the difficulty.`,
      "Rules: exactly four options; exactly one correct option; no \"all of the above\"/\"none of the above\"; numeric questions must still offer four concrete options; the explanation must justify the key and briefly say why the distractors are wrong.",
      "Write the explanation as finished teacher-facing prose. Never include working notes, self-correction, option indexes, or phrases such as \"Wait\", \"Let me check\" or \"the correct index\".",
      "Each question must be self-contained, use unambiguous wording and SI units. Do not mention the exam, the syllabus or the AI.",
      "Set topic to one of the allowed topic titles exactly as written above.",
      "Format: {\"questions\":[{\"topic\":\"...\",\"text\":\"...\",\"difficulty\":\"MEDIUM\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"correctIndex\":1,\"explanation\":\"...\"}]}",
    ].filter(Boolean).join("\n"),
  }).then((result) => {
    if (!result.ok) return result;
    const reasoningLeak = /\b(wait|let'?s check|let me|i need to|correct index|option index|index \d)\b/i;
    const valid = result.data.questions.filter((question) => {
      const options = question.options.map((option) => option.trim()).filter(Boolean);
      if (options.length !== 4) return false;
      if (new Set(options.map((option) => option.toLowerCase())).size !== 4) return false;
      if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) return false;
      if (reasoningLeak.test(question.explanation)) return false;
      return question.explanation.trim().length >= 20;
    });
    if (!valid.length) {
      return {
        ok: false as const,
        code: "INVALID_RESPONSE" as const,
        message: "The AI returned questions that failed structural validation. Please try again.",
      };
    }
    return { ...result, data: valid };
  });
}

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
    system: `${SAFETY_RULE} All marks and percentages have already been calculated by the platform. Do not recalculate or dispute them. Interpret the numbers and give specific, actionable study advice. Numerical answers are graded on numeric value: a unit or symbol after the number, such as 3A for 3 or 12 V for 12, is accepted. Never describe a unit suffix as an error or as a wrong answer. ${JSON_RULE}`,
    prompt: [
      `Exam: ${input.examName} (${input.level} preparation level)`,
      `Deterministic result: ${input.correct} correct, ${input.incorrect} incorrect, ${input.unanswered} unanswered out of ${input.totalQuestions}.`,
      `Accuracy: ${input.accuracy.toFixed(2)}%. Score: ${input.scorePercent.toFixed(2)}%. Time: ${Math.round(input.timeTakenSeconds / 60)} of ${input.durationMinutes} minutes.`,
      `Weakest subjects: ${input.weakestSubjects.map((s) => `${s.name} (${s.accuracy.toFixed(0)}%)`).join(", ") || "none recorded"}.`,
      `Weakest topics: ${input.weakestTopics.map((t) => `${t.title} (${t.accuracy.toFixed(0)}%)`).join(", ") || "none recorded"}.`,
      "Numerical answers may be written with or without units: 3, 3 A and 3A are the same answer.",
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
    summary: `${strength} Use the subject and topic breakdown above to decide what to revise next.`,
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
