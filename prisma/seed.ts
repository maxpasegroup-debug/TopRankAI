import { DAILY_PAPERS } from "../src/shared/daily-workload";
import "dotenv/config";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/server/env";
import {
  achievements,
  allQuestions,
  categories,
  examPatterns,
  exams,
  subjectCatalogue,
  syllabusBySubject,
  type QuestionSeed,
} from "./platform-seed";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

const published = { status: "PUBLISHED" as const, active: true };

async function seedCatalogue() {
  const categoryBySlug = new Map<string, { id: string; name: string }>();
  for (const category of categories) {
    const record = await prisma.examCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description, icon: category.icon, color: category.color, order: category.order, active: true },
      create: { ...category, active: true },
    });
    categoryBySlug.set(category.slug, record);
  }

  const subjectByCode = new Map<string, { id: string; slug: string; name: string }>();
  for (const subject of subjectCatalogue) {
    const record = await prisma.subject.upsert({
      where: { slug: subject.slug },
      update: { code: subject.code, name: subject.name, ...published },
      create: { code: subject.code, name: subject.name, slug: subject.slug, ...published },
    });
    subjectByCode.set(subject.code, { id: record.id, slug: record.slug, name: record.name });
  }

  const examByCode = new Map<string, { id: string; code: string; name: string; positive: number; negative: number; subjectCodes: string[] }>();
  for (const exam of exams) {
    const category = categoryBySlug.get(exam.categorySlug);
    if (!category) throw new Error(`Unknown category ${exam.categorySlug} for ${exam.code}`);
    const record = await prisma.exam.upsert({
      where: { code: exam.code },
      update: {
        name: exam.name,
        shortName: exam.shortName,
        category: category.name,
        categoryId: category.id,
        description: exam.description,
        officialUrl: exam.officialUrl,
        defaultPreparationLevel: exam.defaultLevel,
        ...published,
      },
      create: {
        code: exam.code,
        name: exam.name,
        shortName: exam.shortName,
        category: category.name,
        categoryId: category.id,
        description: exam.description,
        officialUrl: exam.officialUrl,
        defaultPreparationLevel: exam.defaultLevel,
        ...published,
      },
    });
    examByCode.set(exam.code, { id: record.id, code: record.code, name: record.name, positive: exam.positiveMarks, negative: exam.negativeMarks, subjectCodes: exam.subjects });

    const pattern = examPatterns[exam.code] ?? null;
    const primaryPart = pattern?.parts[0] ?? null;

    await prisma.examConfiguration.upsert({
      where: { examId: record.id },
      update: {
        durationMinutes: primaryPart?.durationMinutes ?? exam.durationMinutes,
        totalQuestions: primaryPart?.totalQuestions ?? exam.totalQuestions,
        positiveMarks: exam.positiveMarks,
        negativeMarks: exam.negativeMarks,
        questionTypes: exam.questionTypes,
        dailyTestQuestions: exam.dailyTestQuestions,
        dailyTestMinutes: exam.dailyTestMinutes,
        markingNote: exam.markingNote,
        sourceUrl: exam.officialUrl,
        sections: (pattern ?? { parts: [] }) as unknown as Prisma.InputJsonValue,
        active: true,
      },
      create: {
        examId: record.id,
        durationMinutes: primaryPart?.durationMinutes ?? exam.durationMinutes,
        totalQuestions: primaryPart?.totalQuestions ?? exam.totalQuestions,
        positiveMarks: exam.positiveMarks,
        negativeMarks: exam.negativeMarks,
        questionTypes: exam.questionTypes,
        dailyTestQuestions: exam.dailyTestQuestions,
        dailyTestMinutes: exam.dailyTestMinutes,
        dailyTestCount: DAILY_PAPERS,
        markingNote: exam.markingNote,
        sourceUrl: exam.officialUrl,
        sections: (pattern ?? { parts: [] }) as unknown as Prisma.InputJsonValue,
        active: true,
      },
    });

    for (const [index, code] of exam.subjects.entries()) {
      const subject = subjectByCode.get(code);
      if (!subject) throw new Error(`Unknown subject ${code} for ${exam.code}`);
      await prisma.examSubject.upsert({
        where: { examId_subjectId: { examId: record.id, subjectId: subject.id } },
        update: { order: index + 1, ...published },
        create: { examId: record.id, subjectId: subject.id, order: index + 1, ...published },
      });
    }
  }

  await prisma.exam.updateMany({
    where: { code: { notIn: exams.map((exam) => exam.code) } },
    data: { active: false, status: "ARCHIVED" },
  });

  return { categoryBySlug, subjectByCode, examByCode };
}

async function seedLegacyContent(subjectByCode: Map<string, { id: string; slug: string; name: string }>) {
  const chapterKeyBySlug = new Map<string, { chapterId: string; chapterSlug: string }>();
  for (const [subjectCode, units] of Object.entries(syllabusBySubject)) {
    const subject = subjectByCode.get(subjectCode);
    if (!subject) continue;
    for (const [unitIndex, unit] of units.entries()) {
      for (const [chapterIndex, chapter] of unit.chapters.entries()) {
        const record = await prisma.chapter.upsert({
          where: { subjectId_slug: { subjectId: subject.id, slug: chapter.slug } },
          update: { title: chapter.title, summary: chapter.description, order: unitIndex * 10 + chapterIndex + 1, ...published },
          create: { subjectId: subject.id, title: chapter.title, slug: chapter.slug, summary: chapter.description, order: unitIndex * 10 + chapterIndex + 1, ...published },
        });
        chapterKeyBySlug.set(`${subjectCode}:${chapter.slug}`, { chapterId: record.id, chapterSlug: chapter.slug });
        for (const [topicIndex, topic] of chapter.topics.entries()) {
          const lesson = await prisma.lesson.upsert({
            where: { chapterId_slug: { chapterId: record.id, slug: topic.slug } },
            update: { title: topic.title, summary: topic.description, order: topicIndex + 1, ...published },
            create: { chapterId: record.id, title: topic.title, slug: topic.slug, summary: topic.description, order: topicIndex + 1, ...published },
          });
          if (topic.content) {
            await prisma.learningResource.upsert({
              where: { lessonId_slug: { lessonId: lesson.id, slug: "study-notes" } },
              update: { title: `${topic.title} — study notes`, type: "NOTES", reference: topic.content, ...published },
              create: { lessonId: lesson.id, title: `${topic.title} — study notes`, slug: "study-notes", type: "NOTES", reference: topic.content, ...published },
            });
          }
        }
      }
    }
  }
  return chapterKeyBySlug;
}

async function seedSyllabus(examByCode: Map<string, { id: string; code: string }>, subjectByCode: Map<string, { id: string; slug: string; name: string }>) {
  const topicIndex = new Map<string, { topicId: string; subjectId: string; chapterSlug: string }>();
  for (const exam of exams) {
    const examRecord = examByCode.get(exam.code);
    if (!examRecord) continue;
    for (const subjectCode of exam.subjects) {
      const subject = subjectByCode.get(subjectCode);
      if (!subject) continue;
      const units = syllabusBySubject[subjectCode] ?? [];
      for (const [unitIndex, unit] of units.entries()) {
        const existing = await prisma.syllabusUnit.findUnique({
          where: { examId_subjectId_slug: { examId: examRecord.id, subjectId: subject.id, slug: unit.slug } },
        });
        if (existing) continue;
        const created = await prisma.syllabusUnit.create({
          data: {
            examId: examRecord.id,
            subjectId: subject.id,
            title: unit.title,
            slug: unit.slug,
            description: unit.description,
            order: unitIndex + 1,
            chapters: {
              create: unit.chapters.map((chapter, chapterIndex) => ({
                title: chapter.title,
                slug: chapter.slug,
                description: chapter.description,
                order: chapterIndex + 1,
                topics: {
                  create: chapter.topics.map((topic, topicIndex2) => ({
                    title: topic.title,
                    slug: topic.slug,
                    description: topic.description,
                    content: topic.content ?? null,
                    formulas: topic.formulas ?? null,
                    estimatedMinutes: topic.estimatedMinutes ?? 30,
                    difficulty: topic.difficulty ?? "MEDIUM",
                    order: topicIndex2 + 1,
                  })),
                },
              })),
            },
          },
          include: { chapters: { include: { topics: { select: { id: true, slug: true } } } } },
        });
        for (const chapter of created.chapters) {
          for (const topic of chapter.topics) {
            const key = `${subjectCode}:${topic.slug}`;
            if (!topicIndex.has(key)) topicIndex.set(key, { topicId: topic.id, subjectId: subject.id, chapterSlug: chapter.slug });
          }
        }
      }
    }
  }
  return topicIndex;
}

async function seedQuestions(
  examByCode: Map<string, { id: string; positive: number; negative: number; subjectCodes: string[] }>,
  subjectByCode: Map<string, { id: string; slug: string; name: string }>,
  topicIndex: Map<string, { topicId: string; subjectId: string; chapterSlug: string }>,
  chapterKeyBySlug: Map<string, { chapterId: string; chapterSlug: string }>,
) {
  for (const question of allQuestions) {
    const subject = subjectByCode.get(question.subject);
    if (!subject) continue;
    const topic = topicIndex.get(`${question.subject}:${question.topicSlug}`) ?? [...topicIndex.entries()].find(([key]) => key.startsWith(`${question.subject}:`))?.[1];
    const chapterKey = topic ? chapterKeyBySlug.get(`${question.subject}:${topic.chapterSlug}`) : undefined;
    const record = await prisma.question.upsert({
      where: { code: question.code },
      update: {
        text: question.text,
        type: question.type,
        difficulty: question.difficulty,
        subjectId: subject.id,
        chapterId: chapterKey?.chapterId ?? null,
        topicId: topic?.topicId ?? null,
        explanation: question.explanation,
        numericalAnswer: question.numericalAnswer ?? null,
        source: "TopRank curated seed",
        sourceType: question.sourceType,
        sourceYear: question.sourceYear ?? null,
        marks: 4,
        negativeMarks: 1,
        language: "en",
        reviewStatus: "REVIEWED",
        approvedAt: new Date(),
        tags: question.tags,
        ...published,
      },
      create: {
        code: question.code,
        text: question.text,
        type: question.type,
        difficulty: question.difficulty,
        subjectId: subject.id,
        chapterId: chapterKey?.chapterId ?? null,
        topicId: topic?.topicId ?? null,
        explanation: question.explanation,
        numericalAnswer: question.numericalAnswer ?? null,
        source: "TopRank curated seed",
        sourceType: question.sourceType,
        sourceYear: question.sourceYear ?? null,
        marks: 4,
        negativeMarks: 1,
        language: "en",
        reviewStatus: "REVIEWED",
        approvedAt: new Date(),
        tags: question.tags,
        ...published,
      },
    });

    for (const [index, option] of question.options.entries()) {
      await prisma.questionOption.upsert({
        where: { questionId_code: { questionId: record.id, code: option.code } },
        update: { text: option.text, order: index + 1, isCorrect: Boolean(option.correct), active: true },
        create: { questionId: record.id, code: option.code, text: option.text, order: index + 1, isCorrect: Boolean(option.correct), active: true },
      });
    }

    for (const exam of examByCode.values()) {
      if (!exam.subjectCodes.includes(question.subject)) continue;
      await prisma.questionExam.upsert({
        where: { questionId_examId: { questionId: record.id, examId: exam.id } },
        update: { status: "PUBLISHED", active: true, marks: exam.positive, negativeMarks: exam.negative },
        create: { questionId: record.id, examId: exam.id, status: "PUBLISHED", active: true, marks: exam.positive, negativeMarks: exam.negative },
      });
    }
  }
}

async function seedAchievements() {
  for (const achievement of achievements) {
    await prisma.achievementDefinition.upsert({
      where: { code: achievement.code },
      update: { title: achievement.title, description: achievement.description, icon: achievement.icon, metric: achievement.metric, threshold: achievement.threshold, xp: achievement.xp, active: true },
      create: { ...achievement, active: true },
    });
  }
}

async function main() {
  const { subjectByCode, examByCode } = await seedCatalogue();
  const chapterKeyBySlug = await seedLegacyContent(subjectByCode);
  const topicIndex = await seedSyllabus(examByCode, subjectByCode);
  await seedQuestions(examByCode, subjectByCode, topicIndex, chapterKeyBySlug);
  await seedAchievements();

  const [examCount, subjectCount, topicCount, questionCount, achievementCount] = await Promise.all([
    prisma.exam.count({ where: published }),
    prisma.subject.count({ where: published }),
    prisma.syllabusTopic.count({ where: { active: true } }),
    prisma.question.count({ where: published }),
    prisma.achievementDefinition.count({ where: { active: true } }),
  ]);

  console.log(`Seed complete: ${examCount} exams, ${subjectCount} subjects, ${topicCount} syllabus topics, ${questionCount} questions, ${achievementCount} achievements.`);
  console.log("Exam dates are intentionally not seeded. Add verified dates from the official source in the admin calendar.");
  console.log("Questions must be reviewed before publication. Legacy verified questions are marked REVIEWED.");
  console.log(`Question seeds available: ${allQuestions.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
