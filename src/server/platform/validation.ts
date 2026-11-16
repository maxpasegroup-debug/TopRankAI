import { z } from "zod";
import { educationStages, indianStates, languages } from "@/shared/india";

export const examSelectionSchema = z.object({
  examId: z.string().min(1).max(100),
  partCode: z.string().min(1).max(80).optional(),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXTREME"]),
  targetYear: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 8),
  dailyMinutes: z.number().int().min(15).max(720),
}).strict();

const baseProfile = {
  name: z.string().trim().min(2).max(120),
  dateOfBirth: z.iso.date(),
  gender: z.enum(["FEMALE", "MALE", "NON_BINARY", "PREFER_NOT_TO_SAY"]),
  state: z.enum(indianStates),
  city: z.string().trim().min(2).max(120),
  education: z.enum(educationStages),
  preferredLanguage: z.enum(languages),
  phone: z.string().trim().regex(/^[+]?[0-9 -]{7,16}$/).optional().or(z.literal("")),
  avatarUrl: z.string().url().max(500).optional().or(z.literal("")),
};

export const registrationSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72).refine((value) => new TextEncoder().encode(value).length <= 72, "Password exceeds the supported byte length."),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  ...baseProfile,
  exams: z.array(examSelectionSchema).min(1).max(8),
}).strict();

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const profileUpdateSchema = z.object({
  ...baseProfile,
  dailyStudyMinutes: z.number().int().min(15).max(720),
  timezone: z.string().min(1).max(100),
}).strict();

export const syllabusProgressSchema = z.object({
  topicId: z.string().min(1).max(100),
  status: z.enum(["NOT_STARTED", "LEARNING", "COMPLETED", "NEEDS_REVISION"]),
  bookmarked: z.boolean().optional(),
  notes: z.string().max(4000).optional(),
}).strict();

export const attemptAnswerSchema = z.array(z.object({
  questionId: z.string().min(1).max(100),
  selected: z.array(z.string().max(120)).max(8).default([]),
  timeSpentSeconds: z.number().int().min(0).max(86_400).default(0),
  flagged: z.boolean().default(false),
})).max(300);

export const adminExamSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(2).max(160),
  shortName: z.string().trim().max(40).optional(),
  categoryId: z.string().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  officialUrl: z.url().max(500).optional().or(z.literal("")),
  durationMinutes: z.number().int().min(10).max(360),
  totalQuestions: z.number().int().min(1).max(300),
  dailyTestQuestions: z.number().int().min(3).max(30),
  dailyTestMinutes: z.number().int().min(3).max(180),
  positiveMarks: z.number().min(0).max(10),
  negativeMarks: z.number().min(0).max(10),
  markingNote: z.string().trim().max(500).optional(),
  subjectIds: z.array(z.string().min(1).max(100)).min(1).max(12),
}).strict();

export const adminCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional(),
  order: z.number().int().min(0).max(1000).default(0),
}).strict();

export const adminQuestionSchema = z.object({
  code: z.string().trim().min(2).max(120).regex(/^[A-Z0-9_-]+$/),
  text: z.string().trim().min(10).max(5000),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  subjectId: z.string().min(1).max(100),
  topicId: z.string().min(1).max(100).optional().or(z.literal("")),
  explanation: z.string().trim().min(10).max(5000),
  numericalAnswer: z.string().trim().max(120).optional().or(z.literal("")),
  options: z.array(z.object({ text: z.string().trim().min(1).max(500), correct: z.boolean() })).max(6),
  examIds: z.array(z.string().min(1).max(100)).min(1).max(20),
  marks: z.number().min(0).max(20),
  negativeMarks: z.number().min(0).max(20),
}).strict();

export const adminSyllabusSchema = z.object({
  examId: z.string().min(1).max(100),
  subjectId: z.string().min(1).max(100),
  unitTitle: z.string().trim().min(2).max(160),
  unitDescription: z.string().trim().max(500).optional(),
  chapterTitle: z.string().trim().min(2).max(160),
  chapterDescription: z.string().trim().max(500).optional(),
  topicTitle: z.string().trim().min(2).max(160),
  topicDescription: z.string().trim().max(800).optional(),
  content: z.string().trim().max(8000).optional(),
}).strict();

export const adminCalendarSchema = z.object({
  examId: z.string().min(1).max(100),
  eventType: z.enum(["APPLICATION_START", "APPLICATION_END", "ADMIT_CARD", "EXAM", "RESULT", "COUNSELLING", "OTHER"]),
  title: z.string().trim().min(3).max(200),
  startDate: z.iso.date(),
  endDate: z.iso.date().optional().or(z.literal("")),
  status: z.enum(["CONFIRMED", "TENTATIVE", "NOT_ANNOUNCED"]),
  sourceUrl: z.url().max(500).optional().or(z.literal("")),
  sourceLabel: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const syllabusImportSchema = z.object({
  examId: z.string().min(1).max(100),
  subjects: z.array(z.object({
    subjectCode: z.string().trim().min(1).max(60),
    units: z.array(z.object({
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(800).optional(),
      chapters: z.array(z.object({
        title: z.string().trim().min(2).max(160),
        description: z.string().trim().max(800).optional(),
        topics: z.array(z.object({
          title: z.string().trim().min(2).max(160),
          description: z.string().trim().max(800).optional(),
          content: z.string().trim().max(8000).optional(),
          estimatedMinutes: z.number().int().min(5).max(600).optional(),
        })).min(1).max(200),
      })).min(1).max(60),
    })).min(1).max(60),
  })).min(1).max(30),
}).strict();

export const calendarImportSchema = z.object({
  examId: z.string().min(1).max(100),
  sourceUrl: z.url().max(500).optional().or(z.literal("")),
  sourceLabel: z.string().trim().max(160).optional(),
  events: z.array(z.object({
    eventType: z.enum(["APPLICATION_START", "APPLICATION_END", "ADMIT_CARD", "EXAM", "RESULT", "COUNSELLING", "OTHER"]),
    title: z.string().trim().min(3).max(200),
    startDate: z.iso.date(),
    endDate: z.iso.date().optional().or(z.literal("")),
    status: z.enum(["CONFIRMED", "TENTATIVE"]),
    notes: z.string().trim().max(1000).optional(),
  })).min(1).max(200),
}).strict();
