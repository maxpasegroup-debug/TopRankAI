import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { AuthorizationApiError } from "@/server/api/errors";
import { requireResourceAccess } from "@/server/commerce/access";
const published = { status: "PUBLISHED" as const, active: true };
const lessonSelect = { id: true, title: true, slug: true, chapter: { select: { slug: true, subject: { select: { slug: true } } } } };
const examSubject = (examId: string) => ({ ...published, examSubjects: { some: { examId, ...published, exam: published } } });
async function accessibleLesson(user: AuthUser, lesson: { id: string } | null) {
  if (!lesson) return false;
  try { await requireResourceAccess("LESSON", lesson.id, user); return true; }
  catch (error) { if (error instanceof AuthorizationApiError) return false; throw error; }
}
export async function missionActionAvailable(user: AuthUser, href: string | null, examId: string) {
  if (!href) return false;
  const lessonPath = /^\/learn\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/.exec(href);
  if (lessonPath) return accessibleLesson(user, await prisma.lesson.findFirst({ where: { ...published, slug: lessonPath[3],
    chapter: { ...published, slug: lessonPath[2], subject: { ...examSubject(examId), slug: lessonPath[1] } } }, select: { id: true } }));
  const practicePath = /^\/practice\/subjects\/([a-z0-9_-]+)\/questions$/.exec(href);
  if (practicePath) return Boolean(await prisma.questionExam.findFirst({ where: { examId, ...published, exam: published, scoringMode: { not: null },
    question: { ...published, reviewStatus: "REVIEWED", subject: { ...examSubject(examId), slug: practicePath[1] }, chapter: { ...published, subject: published },
      OR: [{ lessonId: null }, { lesson: { ...published, chapter: { ...published, subject: published } } }] } }, select: { id: true } }));
  return false;
}
export async function nextAccessibleLesson(user: AuthUser, examId: string) {
  const lessons = await prisma.lesson.findMany({ where: { ...published, chapter: { ...published, subject: examSubject(examId) },
    studentProgress: { none: { userId: user.id, completedAt: { not: null } } } }, orderBy: [{ order: "asc" }, { id: "asc" }], take: 20, select: lessonSelect });
  for (const lesson of lessons) if (await accessibleLesson(user, lesson)) return { title: lesson.title,
    href: `/learn/${lesson.chapter.subject.slug}/${lesson.chapter.slug}/${lesson.slug}` };
  return null;
}
export async function nextAvailablePractice(examId: string) {
  const link = await prisma.questionExam.findFirst({ where: { examId, ...published, exam: published, scoringMode: { not: null },
    question: { ...published, reviewStatus: "REVIEWED", subject: examSubject(examId), chapter: { ...published, subject: published },
      OR: [{ lessonId: null }, { lesson: { ...published, chapter: { ...published, subject: published } } }] } }, orderBy: { id: "asc" },
    select: { question: { select: { subject: { select: { name: true, slug: true } } } } } });
  return link ? { title: link.question.subject.name, href: `/practice/subjects/${link.question.subject.slug}/questions` } : null;
}
