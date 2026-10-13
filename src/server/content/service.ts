import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { safeResourceUrl } from "./resource-url";
import { requireResourceAccess } from "@/server/commerce/access";
import { lessonBodySchema, type LessonBody } from "@/shared/lesson-content";

const publishedActive = {
  status: "PUBLISHED" as const,
  active: true,
};

export type ContentExamDto = {
  code: string;
  name: string;
};

export type ContentSubjectDto = {
  code: string | null;
  name: string;
  slug: string;
  href: string;
  order?: number;
};

export type ContentChapterDto = {
  title: string;
  slug: string;
  summary: string | null;
  href: string;
  order: number;
};

export type ContentLessonDto = {
  title: string;
  slug: string;
  summary: string | null;
  href: string;
  order: number;
};

export type ContentResourceDto = {
  id: string;
  title: string;
  slug: string;
  type: string;
  url: string | null;
  reference: string | null;
  order: number;
};

export type LessonDetailDto = ContentLessonDto & {
  id: string;
  body: LessonBody | null;
  chapter: ContentChapterDto;
  subject: ContentSubjectDto;
  resources: ContentResourceDto[];
};

export function requireStudentContentAccess(user: AuthUser | null) {
  if (!user) {
    throw new AuthorizationApiError("Authentication required");
  }

  if (user.role !== "STUDENT") {
    throw new AuthorizationApiError("Only student accounts can access learning content");
  }

  return user;
}

export async function listPublishedExams(): Promise<ContentExamDto[]> {
  const exams = await prisma.exam.findMany({
    where: publishedActive,
    orderBy: { code: "asc" },
    select: { code: true, name: true },
  });

  return exams;
}

export async function listSubjectsForExam(examCode: string): Promise<{ exam: ContentExamDto; subjects: ContentSubjectDto[] }> {
  const exam = await prisma.exam.findFirst({
    where: { code: examCode, ...publishedActive },
    select: {
      code: true,
      name: true,
      examSubjects: {
        where: {
          ...publishedActive,
          subject: publishedActive,
        },
        orderBy: { order: "asc" },
        select: {
          order: true,
          subject: {
            select: { code: true, name: true, slug: true },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new ValidationApiError("Exam content was not found");
  }

  return {
    exam: { code: exam.code, name: exam.name },
    subjects: exam.examSubjects.map((item) => ({
      code: item.subject.code,
      name: item.subject.name,
      slug: item.subject.slug,
      href: `/learn/${item.subject.slug}`,
      order: item.order,
    })),
  };
}

export async function listChaptersForSubject(subjectSlug: string): Promise<{ subject: ContentSubjectDto; chapters: ContentChapterDto[] }> {
  const subject = await prisma.subject.findFirst({
    where: { slug: subjectSlug, ...publishedActive },
    select: {
      code: true,
      name: true,
      slug: true,
      chapters: {
        where: publishedActive,
        orderBy: { order: "asc" },
        select: { title: true, slug: true, summary: true, order: true },
      },
    },
  });

  if (!subject) {
    throw new ValidationApiError("Subject content was not found");
  }

  return {
    subject: { code: subject.code, name: subject.name, slug: subject.slug, href: `/learn/${subject.slug}` },
    chapters: subject.chapters.map((chapter) => ({
      ...chapter,
      href: `/learn/${subject.slug}/${chapter.slug}`,
    })),
  };
}

export async function listLessonsForChapter(chapterSlug: string, subjectSlug?: string): Promise<{ subject: ContentSubjectDto; chapter: ContentChapterDto; lessons: ContentLessonDto[] }> {
  let chapterId: string | undefined;
  if (!subjectSlug) {
    const matches = await prisma.chapter.findMany({ where: { slug: chapterSlug, ...publishedActive, subject: publishedActive }, take: 2, select: { id: true } });
    if (matches.length !== 1) throw new ValidationApiError("Chapter content was not found or requires a subject context");
    chapterId = matches[0].id;
  }
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, slug: chapterSlug, ...publishedActive, subject: { ...publishedActive, slug: subjectSlug } },
    select: {
      title: true,
      slug: true,
      summary: true,
      order: true,
      subject: { select: { code: true, name: true, slug: true } },
      lessons: {
        where: publishedActive,
        orderBy: { order: "asc" },
        select: { title: true, slug: true, summary: true, order: true },
      },
    },
  });

  if (!chapter) {
    throw new ValidationApiError("Chapter content was not found");
  }

  const subject = {
    code: chapter.subject.code,
    name: chapter.subject.name,
    slug: chapter.subject.slug,
    href: `/learn/${chapter.subject.slug}`,
  };

  return {
    subject,
    chapter: {
      title: chapter.title,
      slug: chapter.slug,
      summary: chapter.summary,
      order: chapter.order,
      href: `/learn/${chapter.subject.slug}/${chapter.slug}`,
    },
    lessons: chapter.lessons.map((lesson) => ({
      ...lesson,
      href: `/learn/${chapter.subject.slug}/${chapter.slug}/${lesson.slug}`,
    })),
  };
}

export async function getLessonDetail(lessonSlug: string, path?: { subjectSlug: string; chapterSlug: string }): Promise<LessonDetailDto> {
  let lessonId: string | undefined;
  if (!path) {
    const matches = await prisma.lesson.findMany({ where: { slug: lessonSlug, ...publishedActive, chapter: { ...publishedActive, subject: publishedActive } }, take: 2, select: { id: true } });
    if (matches.length !== 1) throw new ValidationApiError("Lesson content was not found or requires its full path context");
    lessonId = matches[0].id;
  }
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, slug: lessonSlug, ...publishedActive, chapter: { ...publishedActive, slug: path?.chapterSlug, subject: { ...publishedActive, slug: path?.subjectSlug } } },
    select: {
      id: true,
      title: true,
      body: true,
      slug: true,
      summary: true,
      order: true,
      chapter: {
        select: {
          title: true,
          slug: true,
          summary: true,
          order: true,
          subject: { select: { code: true, name: true, slug: true } },
        },
      },
      resources: {
        where: publishedActive,
        orderBy: { order: "asc" },
        select: { id: true, title: true, slug: true, type: true, url: true, reference: true, order: true },
      },
    },
  });

  if (!lesson) {
    throw new ValidationApiError("Lesson content was not found");
  }

  await requireResourceAccess("LESSON", lesson.id);

  const subject = {
    code: lesson.chapter.subject.code,
    name: lesson.chapter.subject.name,
    slug: lesson.chapter.subject.slug,
    href: `/learn/${lesson.chapter.subject.slug}`,
  };

  const chapter = {
    title: lesson.chapter.title,
    slug: lesson.chapter.slug,
    summary: lesson.chapter.summary,
    order: lesson.chapter.order,
    href: `/learn/${lesson.chapter.subject.slug}/${lesson.chapter.slug}`,
  };

  return {
    id: lesson.id,
    body: (() => { const parsed = lessonBodySchema.safeParse(lesson.body); return parsed.success ? parsed.data : null; })(),
    title: lesson.title,
    slug: lesson.slug,
    summary: lesson.summary,
    order: lesson.order,
    href: `/learn/${lesson.chapter.subject.slug}/${lesson.chapter.slug}/${lesson.slug}`,
    subject,
    chapter,
    resources: lesson.resources.map((resource) => ({ ...resource, url: safeResourceUrl(resource.url) })),
  };
}

export async function getStudentLearningHome(user: AuthUser) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { targetExam: true },
  });

  if (!profile?.targetExam?.code) {
    return { exam: null, subjects: [] };
  }

  return listSubjectsForExam(profile.targetExam.code);
}
