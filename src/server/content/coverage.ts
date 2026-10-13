import type { AuthUser } from "@/server/auth/session";
import { assertPlatformAdmin } from "@/server/operations/service";
import { prisma } from "@/server/db";
import { isTeachingBody } from "@/shared/lesson-content";
import { editorialFingerprint } from "./editorial";
const targets = [{ code: "JEE_MAIN", subjects: ["PHYSICS", "CHEMISTRY", "MATHEMATICS"] }, { code: "NEET", subjects: ["PHYSICS", "CHEMISTRY", "BIOLOGY"] }];
export async function getLaunchContentCoverage(user: AuthUser) {
  assertPlatformAdmin(user);
  const published = { status: "PUBLISHED" as const, active: true };
  const exams = await prisma.exam.findMany({ where: { code: { in: targets.map(target => target.code) } }, select: { id: true, code: true, name: true, status: true, active: true } });
  const links = await prisma.examSubject.findMany({ where: { examId: { in: exams.map(exam => exam.id) } }, take: 21, select: { examId: true, status: true, active: true, subject: { select: { id: true, code: true, status: true, active: true } } } });
  const chapters = await prisma.chapter.findMany({ where: { ...published, subjectId: { in: links.slice(0, 20).map(link => link.subject.id) } }, take: 201, orderBy: { id: "asc" }, select: { id: true, subjectId: true } });
  const lessons = await prisma.lesson.findMany({ where: { ...published, chapterId: { in: chapters.slice(0, 200).map(chapter => chapter.id) } }, take: 501, orderBy: { id: "asc" },
    select: { id: true, chapterId: true, title: true, slug: true, summary: true, order: true, body: true } });
  const reviews = await prisma.contentEditorialRecord.findMany({ where: { entity: "LESSON", entityId: { in: lessons.slice(0, 500).map(lesson => lesson.id) } } });
  const reviewed = (lesson: typeof lessons[number]) => { const review = reviews.find(row => row.entityId === lesson.id);
    return isTeachingBody(lesson.body) && Boolean(review?.reviewerId && review.reviewerId !== review.authorId && review.reviewedAt && review.reviewEvidence && review.reviewedRevision === review.revision && review.reviewedFingerprint === editorialFingerprint(lesson)); };
  const truncated = links.length > 20 || chapters.length > 200 || lessons.length > 500;
  return { truncated, coverageSignoffRequired: true, exams: targets.map(target => {
    const exam = exams.find(row => row.code === target.code);
    return { code: target.code, available: Boolean(exam?.active && exam.status === "PUBLISHED"), subjects: target.subjects.map(code => {
      const link = links.slice(0, 20).find(row => row.examId === exam?.id && row.subject.code === code);
      const available = Boolean(link?.active && link.status === "PUBLISHED" && link.subject.active && link.subject.status === "PUBLISHED");
      const subjectChapters = available ? chapters.slice(0, 200).filter(row => row.subjectId === link!.subject.id) : [];
      const subjectLessons = lessons.slice(0, 500).filter(row => subjectChapters.some(chapter => chapter.id === row.chapterId));
      const reviewedLessons = subjectLessons.filter(reviewed).length;
      return { code, available, chapters: subjectChapters.length, publishedLessons: subjectLessons.length, reviewedLessons, pendingReview: subjectLessons.length - reviewedLessons };
    }) };
  }) };
}
