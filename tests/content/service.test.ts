import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import type { AuthUser } from "@/server/auth/session";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  prisma: {
    commerceGate: { findUnique: vi.fn() },
    entitlement: { findFirst: vi.fn() },
    exam: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    subject: {
      findFirst: vi.fn(),
    },
    chapter: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    lesson: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.currentUser }));

const student: AuthUser = { id: "student_1", email: "s@example.com", name: "Student", role: "STUDENT" };
const parent: AuthUser = { id: "parent_1", email: "p@example.com", name: "Parent", role: "PARENT" };

describe("content service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.commerceGate.findUnique.mockResolvedValue(null);
    mocks.currentUser.mockResolvedValue(student);
    mocks.prisma.chapter.findMany.mockResolvedValue([{ id: "chapter-1" }]);
    mocks.prisma.lesson.findMany.mockResolvedValue([{ id: "lesson-1" }]);
  });

  it("retrieves published active exams", async () => {
    mocks.prisma.exam.findMany.mockResolvedValue([{ code: "NEET", name: "National Eligibility cum Entrance Test" }]);
    const { listPublishedExams } = await import("@/server/content/service");

    await expect(listPublishedExams()).resolves.toEqual([{ code: "NEET", name: "National Eligibility cum Entrance Test" }]);
    expect(mocks.prisma.exam.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "PUBLISHED", active: true } }));
  });

  it("retrieves subjects by exam with published-only relation filters", async () => {
    mocks.prisma.exam.findFirst.mockResolvedValue({
      code: "NEET",
      name: "National Eligibility cum Entrance Test",
      examSubjects: [{ order: 1, subject: { code: "PHYSICS", name: "Physics", slug: "physics" } }],
    });
    const { listSubjectsForExam } = await import("@/server/content/service");
    const result = await listSubjectsForExam("NEET");

    expect(result.subjects[0]).toMatchObject({ slug: "physics", href: "/learn/physics" });
    expect(mocks.prisma.exam.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: "NEET", status: "PUBLISHED", active: true },
    }));
  });

  it("rejects invalid exam code lookups", async () => {
    mocks.prisma.exam.findFirst.mockResolvedValue(null);
    const { listSubjectsForExam } = await import("@/server/content/service");

    await expect(listSubjectsForExam("MISSING")).rejects.toBeInstanceOf(ValidationApiError);
  });

  it("retrieves chapters and excludes unpublished content through query filters", async () => {
    mocks.prisma.subject.findFirst.mockResolvedValue({
      code: "PHYSICS",
      name: "Physics",
      slug: "physics",
      chapters: [{ title: "Motion in a Straight Line", slug: "motion-in-a-straight-line", summary: "Kinematics", order: 1 }],
    });
    const { listChaptersForSubject } = await import("@/server/content/service");
    const result = await listChaptersForSubject("physics");

    expect(result.chapters[0].href).toBe("/learn/physics/motion-in-a-straight-line");
    expect(mocks.prisma.subject.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "physics", status: "PUBLISHED", active: true },
    }));
  });

  it("retrieves lessons for a chapter", async () => {
    mocks.prisma.chapter.findFirst.mockResolvedValue({
      title: "Motion in a Straight Line",
      slug: "motion-in-a-straight-line",
      summary: "Kinematics",
      order: 1,
      subject: { code: "PHYSICS", name: "Physics", slug: "physics" },
      lessons: [{ title: "Distance and Displacement", slug: "distance-and-displacement", summary: "Basics", order: 1 }],
    });
    const { listLessonsForChapter } = await import("@/server/content/service");
    const result = await listLessonsForChapter("motion-in-a-straight-line");

    expect(result.lessons[0].href).toBe("/learn/physics/motion-in-a-straight-line/distance-and-displacement");
  });

  it("retrieves lesson detail with resources", async () => {
    mocks.prisma.lesson.findFirst.mockResolvedValue({
      title: "Distance and Displacement",
      slug: "distance-and-displacement",
      summary: "Basics",
      order: 1,
      chapter: {
        title: "Motion in a Straight Line",
        slug: "motion-in-a-straight-line",
        summary: "Kinematics",
        order: 1,
        subject: { code: "PHYSICS", name: "Physics", slug: "physics" },
      },
      resources: [{ title: "Notes", slug: "foundation-notes", type: "NOTES", url: null, reference: "Seeded", order: 1 }],
    });
    const { getLessonDetail } = await import("@/server/content/service");
    const result = await getLessonDetail("distance-and-displacement");

    expect(result.resources).toHaveLength(1);
    expect(result.subject.slug).toBe("physics");
  });
  it("rejects ambiguous lesson slugs rather than choosing another chapter", async () => {
    mocks.prisma.lesson.findMany.mockResolvedValue([{ id: "one" }, { id: "two" }]);
    const { getLessonDetail } = await import("@/server/content/service");
    await expect(getLessonDetail("shared-slug")).rejects.toBeInstanceOf(ValidationApiError);
    expect(mocks.prisma.lesson.findFirst).not.toHaveBeenCalled();
  });
  it("rejects ambiguous chapter slugs rather than choosing another subject", async () => {
    mocks.prisma.chapter.findMany.mockResolvedValue([{ id: "one" }, { id: "two" }]);
    const { listLessonsForChapter } = await import("@/server/content/service");
    await expect(listLessonsForChapter("shared-slug")).rejects.toBeInstanceOf(ValidationApiError);
    expect(mocks.prisma.chapter.findFirst).not.toHaveBeenCalled();
  });

  it("denies paid lesson detail before disclosing resources when entitlement is absent", async () => {
    mocks.prisma.lesson.findFirst.mockResolvedValue({ id: "paid-lesson" });
    mocks.prisma.commerceGate.findUnique.mockResolvedValue({ featureCode: "LESSON_ACCESS" });
    mocks.prisma.entitlement.findFirst.mockResolvedValue(null);
    const { getLessonDetail } = await import("@/server/content/service");
    await expect(getLessonDetail("paid-lesson")).rejects.toBeInstanceOf(AuthorizationApiError);
  });

  it("rejects unauthorized non-student roles", async () => {
    const { requireStudentContentAccess } = await import("@/server/content/service");

    expect(() => requireStudentContentAccess(parent)).toThrow(AuthorizationApiError);
  });
  it("resolves lesson paths within their actual chapter and subject", async () => {
    mocks.prisma.lesson.findFirst.mockResolvedValue(null);
    const { getLessonDetail } = await import("@/server/content/service");
    await expect(getLessonDetail("shared-slug", { subjectSlug: "biology", chapterSlug: "cells" })).rejects.toBeInstanceOf(ValidationApiError);
    expect(mocks.prisma.lesson.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      chapter: { status: "PUBLISHED", active: true, slug: "cells", subject: { status: "PUBLISHED", active: true, slug: "biology" } },
    }) }));
  });

  it("uses the authenticated student's selected exam for learning home", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ targetExam: { code: "NEET" } });
    mocks.prisma.exam.findFirst.mockResolvedValue({
      code: "NEET",
      name: "National Eligibility cum Entrance Test",
      examSubjects: [],
    });
    const { getStudentLearningHome } = await import("@/server/content/service");

    await getStudentLearningHome(student);

    expect(mocks.prisma.studentProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: student.id } }));
    expect(mocks.prisma.exam.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ code: "NEET" }) }));
  });

  it("does not return Rahul or demo content from production content service", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ targetExam: null });
    const { getStudentLearningHome } = await import("@/server/content/service");

    await expect(getStudentLearningHome(student)).resolves.toEqual({ exam: null, subjects: [] });
  });

  it("uses idempotent seed operations and avoids destructive resets", () => {
    const seed = readFileSync("prisma/seed.ts", "utf8");

    expect(seed).toContain("upsert");
    expect(seed).not.toContain("deleteMany");
    expect(seed).not.toContain("DROP TABLE");
  });
});
