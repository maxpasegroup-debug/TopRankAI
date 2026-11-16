import { prisma } from "@/server/db";
import { readExamPattern, type PatternPart } from "./patterns";
import { toNumber } from "./utils";

export type PublicExam = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string;
  categorySlug: string | null;
  description: string | null;
  officialUrl: string | null;
  durationMinutes: number;
  totalQuestions: number;
  dailyTestQuestions: number;
  dailyTestMinutes: number;
  positiveMarks: number;
  negativeMarks: number;
  markingNote: string | null;
  subjectNames: string[];
  unitCount: number;
  questionCount: number;
  parts: PatternPart[];
  patternNote: string | null;
};

const examInclude = {
  examCategory: { select: { name: true, slug: true } },
  configuration: true,
  examSubjects: { include: { subject: { select: { name: true } } }, orderBy: { order: "asc" as const } },
  _count: { select: { questionExams: true, syllabusUnits: true } },
};

function mapExam(exam: {
  id: string; code: string; name: string; shortName: string | null; category: string;
  examCategory: { name: string; slug: string } | null; description: string | null; officialUrl: string | null;
  configuration: { durationMinutes: number; totalQuestions: number; dailyTestQuestions: number; dailyTestMinutes: number; positiveMarks: unknown; negativeMarks: unknown; markingNote: string | null; sections: unknown } | null;
  examSubjects: { subject: { name: string } }[];
  _count: { questionExams: number; syllabusUnits: number };
}): PublicExam {
  const pattern = readExamPattern(exam.configuration?.sections);
  return {
    id: exam.id,
    code: exam.code,
    name: exam.name,
    shortName: exam.shortName,
    category: exam.examCategory?.name ?? exam.category,
    categorySlug: exam.examCategory?.slug ?? null,
    description: exam.description,
    officialUrl: exam.officialUrl,
    durationMinutes: exam.configuration?.durationMinutes ?? 60,
    totalQuestions: exam.configuration?.totalQuestions ?? 60,
    dailyTestQuestions: exam.configuration?.dailyTestQuestions ?? 8,
    dailyTestMinutes: exam.configuration?.dailyTestMinutes ?? 12,
    positiveMarks: toNumber(exam.configuration?.positiveMarks ?? 4),
    negativeMarks: toNumber(exam.configuration?.negativeMarks ?? 0),
    markingNote: exam.configuration?.markingNote ?? null,
    subjectNames: exam.examSubjects.map((link) => link.subject.name),
    unitCount: exam._count.syllabusUnits,
    questionCount: exam._count.questionExams,
    parts: pattern?.parts ?? [],
    patternNote: pattern?.note ?? null,
  };
}

export async function getPublicCatalogue() {
  const published = { active: true, status: "PUBLISHED" as const };
  const [categories, exams] = await Promise.all([
    prisma.examCategory.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { exams: { where: published } } } },
    }),
    prisma.exam.findMany({
      where: published,
      orderBy: [{ name: "asc" }],
      include: examInclude,
    }),
  ]);
  const mapped = exams.map(mapExam);
  return {
    categories: categories
      .filter((category) => category._count.exams > 0)
      .map((category) => ({ id: category.id, name: category.name, slug: category.slug, description: category.description, icon: category.icon, color: category.color, count: category._count.exams })),
    exams: mapped,
    grouped: categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        exams: mapped.filter((exam) => exam.categorySlug === category.slug),
      }))
      .filter((group) => group.exams.length > 0),
  };
}

export async function getPublicExam(code: string) {
  const exam = await prisma.exam.findFirst({
    where: { code: code.toUpperCase(), active: true, status: "PUBLISHED" },
    include: {
      ...examInclude,
      calendarEvents: { where: { status: { in: ["CONFIRMED", "TENTATIVE"] } }, orderBy: { startDate: "asc" } },
      syllabusUnits: {
        where: { active: true },
        orderBy: [{ subjectId: "asc" }, { order: "asc" }],
        include: {
          subject: { select: { name: true } },
          chapters: { where: { active: true }, orderBy: { order: "asc" }, select: { id: true, title: true, topics: { where: { active: true }, select: { id: true } } } },
        },
      },
    },
  });
  if (!exam) return null;
  const topicCount = exam.syllabusUnits.reduce(
    (total, unit) => total + unit.chapters.reduce((count, chapter) => count + chapter.topics.length, 0),
    0,
  );
  return {
    exam: mapExam(exam),
    topicCount,
    subjects: exam.syllabusUnits.reduce<{ name: string; units: { title: string; chapters: number; topics: number }[] }[]>((acc, unit) => {
      const existing = acc.find((item) => item.name === unit.subject.name);
      const row = {
        title: unit.title,
        chapters: unit.chapters.length,
        topics: unit.chapters.reduce((count, chapter) => count + chapter.topics.length, 0),
      };
      if (existing) existing.units.push(row);
      else acc.push({ name: unit.subject.name, units: [row] });
      return acc;
    }, []),
    dates: exam.calendarEvents.map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
      sourceUrl: event.sourceUrl,
      sourceLabel: event.sourceLabel,
    })),
  };
}

export async function getPlatformStats() {
  const [exams, topics, questions, achievements, categories] = await Promise.all([
    prisma.exam.count({ where: { active: true, status: "PUBLISHED" } }),
    prisma.syllabusTopic.count({ where: { active: true } }),
    prisma.question.count({ where: { active: true, status: "PUBLISHED", reviewStatus: "REVIEWED" } }),
    prisma.achievementDefinition.count({ where: { active: true } }),
    prisma.examCategory.count({ where: { active: true } }),
  ]);
  return { exams, topics, questions, achievements, categories };
}

export async function getRegistrationOptions() {
  const { grouped } = await getPublicCatalogue();
  return grouped.map((group) => ({
    name: group.name,
    slug: group.slug,
    exams: group.exams.map((exam) => ({
      id: exam.id,
      code: exam.code,
      name: exam.name,
      shortName: exam.shortName,
      subjectNames: exam.subjectNames,
      dailyTestQuestions: exam.dailyTestQuestions,
      dailyTestMinutes: exam.dailyTestMinutes,
      parts: exam.parts.map((part) => ({
        code: part.code,
        name: part.name,
        durationMinutes: part.durationMinutes,
        totalQuestions: part.totalQuestions,
        totalMarks: part.totalMarks,
        verified: part.verified,
      })),
    })),
  }));
}
