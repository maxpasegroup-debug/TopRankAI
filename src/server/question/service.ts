import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

const publishedActive = {
  status: "PUBLISHED" as const,
  active: true,
};

export type QuestionFilter = {
  exam?: string;
  subject?: string;
  chapter?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  type?: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "NUMERICAL";
};

export type StudentQuestionOptionDto = {
  id: string;
  code: string;
  text: string;
  order: number;
};

export type StudentQuestionDto = {
  id: string;
  code: string;
  text: string;
  type: string;
  difficulty: string;
  subject: { code: string | null; name: string; slug: string };
  chapter: { title: string; slug: string };
  lesson: { title: string; slug: string } | null;
  exams: { code: string; name: string }[];
  tags: string[];
  options: StudentQuestionOptionDto[];
};

export type PracticeHomeSubjectDto = {
  code: string | null;
  title: string;
  slug: string;
  href: string;
  questions: number;
  difficulty: string;
  progress: number;
};

type QuestionRecord = {
  id: string;
  code: string;
  text: string;
  type: string;
  difficulty: string;
  tags: string[];
  subject: { code: string | null; name: string; slug: string };
  chapter: { title: string; slug: string };
  lesson: { title: string; slug: string } | null;
  options: { id: string; code: string; text: string; order: number; isCorrect?: boolean }[];
  exams: { exam: { code: string; name: string } }[];
  explanation?: string | null;
  solutionRef?: string | null;
  numericalAnswer?: string | null;
};

export function requireStudentQuestionAccess(user: AuthUser | null) {
  if (!user) {
    throw new AuthorizationApiError("Authentication required");
  }

  if (user.role !== "STUDENT") {
    throw new AuthorizationApiError("Only student accounts can access practice questions");
  }

  return user;
}

function questionWhere(filters: QuestionFilter = {}) {
  return {
    ...publishedActive,
    reviewStatus: "REVIEWED" as const,
    difficulty: filters.difficulty,
    type: filters.type,
    subject: { ...publishedActive, slug: filters.subject },
    chapter: { ...publishedActive, slug: filters.chapter },
    exams: {
      some: {
        ...publishedActive,
        scoringMode: { not: null },
        exam: { ...publishedActive, code: filters.exam },
      },
    },
  };
}

function questionSelect() {
  return {
    id: true,
    code: true,
    text: true,
    type: true,
    difficulty: true,
    tags: true,
    subject: { select: { code: true, name: true, slug: true } },
    chapter: { select: { title: true, slug: true } },
    lesson: { select: { title: true, slug: true } },
    options: {
      where: { active: true },
      orderBy: { order: "asc" as const },
      select: { id: true, code: true, text: true, order: true },
    },
    exams: {
      where: publishedActive,
      select: { exam: { select: { code: true, name: true } } },
      orderBy: { exam: { code: "asc" as const } },
    },
  };
}

export function sanitizeStudentQuestion(question: QuestionRecord): StudentQuestionDto {
  if (!["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"].includes(question.type)) {
    throw new ValidationApiError("Practice question was not found");
  }

  return {
    id: question.id,
    code: question.code,
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    subject: { code: question.subject.code, name: question.subject.name, slug: question.subject.slug },
    chapter: { title: question.chapter.title, slug: question.chapter.slug },
    lesson: question.lesson ? { title: question.lesson.title, slug: question.lesson.slug } : null,
    exams: question.exams.map(({ exam }) => ({ code: exam.code, name: exam.name })),
    tags: question.tags,
    options: question.type === "NUMERICAL" ? [] : question.options.map((option) => ({
      id: option.id,
      code: option.code,
      text: option.text,
      order: option.order,
    })),
  };
}

export async function listQuestions(filters: QuestionFilter = {}): Promise<StudentQuestionDto[]> {
  const questions = await prisma.question.findMany({
    where: questionWhere(filters),
    orderBy: [{ difficulty: "asc" }, { code: "asc" }],
    take: 50,
    select: questionSelect(),
  });

  return questions.map((question) => sanitizeStudentQuestion(question));
}

export async function getQuestion(questionId: string, filters: QuestionFilter = {}): Promise<StudentQuestionDto> {
  const question = await prisma.question.findFirst({
    where: {
      OR: [{ id: questionId }, { code: questionId }],
      ...questionWhere(filters),
    },
    select: questionSelect(),
  });

  if (!question) {
    throw new ValidationApiError("Practice question was not found");
  }

  return sanitizeStudentQuestion(question);
}

export async function listQuestionsForSubject(subjectSlug: string, filters: QuestionFilter = {}) {
  const subject = await prisma.subject.findFirst({
    where: { slug: subjectSlug, ...publishedActive },
    select: { code: true, name: true, slug: true },
  });

  if (!subject) {
    throw new ValidationApiError("Practice subject was not found");
  }

  return {
    subject,
    questions: await listQuestions({ ...filters, subject: subjectSlug }),
  };
}

export async function listQuestionsForChapter(chapterSlug: string, filters: QuestionFilter = {}) {
  const chapter = await prisma.chapter.findFirst({
    where: { slug: chapterSlug, ...publishedActive, subject: publishedActive },
    select: {
      title: true,
      slug: true,
      subject: { select: { code: true, name: true, slug: true } },
    },
  });

  if (!chapter) {
    throw new ValidationApiError("Practice chapter was not found");
  }

  return {
    subject: chapter.subject,
    chapter: { title: chapter.title, slug: chapter.slug },
    questions: await listQuestions({ ...filters, chapter: chapterSlug }),
  };
}

export async function getStudentPracticeHome(user: AuthUser) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { targetExam: true },
  });

  if (!profile?.targetExam?.code) {
    return { exam: null, subjects: [] };
  }

  const subjects = await prisma.examSubject.findMany({
    where: {
      ...publishedActive,
      exam: { code: profile.targetExam.code, ...publishedActive },
      subject: publishedActive,
    },
    orderBy: { order: "asc" },
    select: {
      subject: {
        select: {
          code: true,
          name: true,
          slug: true,
          _count: {
            select: {
              questions: {
                where: questionWhere({ exam: profile.targetExam.code }),
              },
            },
          },
        },
      },
    },
  });

  return {
    exam: { code: profile.targetExam.code, name: profile.targetExam.name },
    subjects: subjects.map(({ subject }) => ({
      code: subject.code,
      title: subject.name,
      slug: subject.slug,
      href: `/practice/subjects/${subject.slug}/questions`,
      questions: subject._count.questions,
      difficulty: "Foundation",
      progress: 0,
    })),
  };
}
