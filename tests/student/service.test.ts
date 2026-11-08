import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import type { AuthUser } from "@/server/auth/session";

const mocks = vi.hoisted(() => {
  const exam = { id: "exam_neet", code: "NEET", name: "National Eligibility cum Entrance Test" };
  const studentUser = { id: "student_1", email: "student@example.com", name: "Anu", phone: null, role: "STUDENT", status: "ACTIVE" };
  const parentUser = { id: "parent_1", email: "parent@example.com", name: "Parent", role: "PARENT" };
  const profile = {
    id: "profile_1",
    userId: "student_1",
    targetExamId: null,
    targetYear: null,
    dreamCollege: null,
    dailyStudyMins: null,
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: studentUser,
    targetExam: null,
  };

  return {
    exam,
    studentUser,
    parentUser,
    profile,
    prisma: {
      exam: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      studentProfile: {
        findUnique: vi.fn(),
      },
      missionTask: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    },
    tx: {
      user: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      studentProfile: {
        upsert: vi.fn(),
      },
    },
  };
});

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));

const student: AuthUser = {
  id: "student_1",
  email: "student@example.com",
  name: "Anu",
  role: "STUDENT",
};

const parent: AuthUser = {
  id: "parent_1",
  email: "parent@example.com",
  name: "Parent",
  role: "PARENT",
};

describe("student service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.exam.findFirst.mockResolvedValue(mocks.exam);
    mocks.prisma.exam.findMany.mockResolvedValue([mocks.exam]);
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ ...mocks.profile });
    mocks.prisma.missionTask.findFirst.mockResolvedValue(null);
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.studentProfile.upsert.mockResolvedValue({
      ...mocks.profile,
      targetExamId: mocks.exam.id,
      targetYear: 2028,
      dreamCollege: "AIIMS Delhi",
      dailyStudyMins: 120,
      onboardingCompletedAt: new Date("2026-09-16T00:00:00.000Z"),
      user: { ...mocks.studentUser, name: "Anu", phone: "9999999999" },
      targetExam: mocks.exam,
    });
  });

  it("creates or updates the authenticated student's profile", async () => {
    const { updateStudentProfile } = await import("@/server/student/service");
    const profile = await updateStudentProfile(student, {
      name: "Anu",
      phone: "9999999999",
      targetExamId: mocks.exam.id,
      targetYear: 2028,
      dreamCollege: "AIIMS Delhi",
      dailyStudyHours: 2,
    });

    expect(mocks.prisma.exam.findFirst).toHaveBeenCalledWith({
      where: { id: mocks.exam.id, status: "PUBLISHED", active: true },
    });
    expect(mocks.tx.studentProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: student.id } }));
    expect(profile.targetExam?.code).toBe("NEET");
    expect(profile.dailyStudyHours).toBe(2);
    expect(profile.onboardingCompleted).toBe(true);
  });

  it("rejects unsupported exam selection", async () => {
    mocks.prisma.exam.findFirst.mockResolvedValue(null);
    const { updateStudentProfile } = await import("@/server/student/service");

    await expect(updateStudentProfile(student, { targetExamId: "missing_exam" })).rejects.toBeInstanceOf(ValidationApiError);
  });

  it("cannot replace or clear the login mobile through an ordinary profile update", async () => {
    mocks.tx.user.updateMany.mockResolvedValue({ count: 0 });
    const { updateStudentProfile } = await import("@/server/student/service");
    await expect(updateStudentProfile(student, { phone: "" })).rejects.toThrow("login mobile");
    expect(mocks.tx.studentProfile.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({ where: { id: student.id, OR: [{ pinHash: null }, { phone: null }] }, data: { name: undefined, phone: null } });
  });
  it("allows profile updates that preserve a PIN account's exact existing mobile", async () => {
    const { updateStudentProfile } = await import("@/server/student/service");
    await updateStudentProfile(student, { phone: "+919876543210" });
    expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({ where: { id: student.id, OR: [{ pinHash: null }, { phone: "+919876543210" }] }, data: { name: undefined, phone: "+919876543210" } });
    expect(mocks.tx.studentProfile.upsert).toHaveBeenCalledOnce();
  });

  it("cannot finish onboarding by manipulating a profile flag", async () => {
    const { updateStudentProfile } = await import("@/server/student/service");
    await expect(updateStudentProfile(student, { completeOnboarding: true })).rejects.toBeInstanceOf(ValidationApiError);
    expect(mocks.tx.studentProfile.upsert).not.toHaveBeenCalled();
  });

  it("rejects parent access to student profile mutation", async () => {
    const { updateStudentProfile } = await import("@/server/student/service");

    await expect(updateStudentProfile(parent, { targetYear: 2028 })).rejects.toBeInstanceOf(AuthorizationApiError);
  });

  it("reports onboarding completion from persisted profile data", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      ...mocks.profile,
      targetExam: mocks.exam,
      targetYear: 2028,
      dreamCollege: "AIIMS Delhi",
      dailyStudyMins: 120,
      onboardingCompletedAt: new Date("2026-09-16T00:00:00.000Z"),
    });
    const { getOnboardingStatus } = await import("@/server/student/service");

    await expect(getOnboardingStatus(student)).resolves.toMatchObject({ completed: true });
  });

  it("creates Mission Control from the authenticated student's data", async () => {
    mocks.prisma.missionTask.findFirst.mockResolvedValue({ subject: "Biology", title: "Cell structure", minutes: 45, href: "/learn/biology/cells/structure" });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      ...mocks.profile,
      user: { ...mocks.studentUser, name: "Anu" },
      targetExam: mocks.exam,
      targetYear: 2028,
      dreamCollege: "AIIMS Delhi",
      dailyStudyMins: 120,
      onboardingCompletedAt: new Date("2026-09-16T00:00:00.000Z"),
    });
    const { getMissionControl } = await import("@/server/student/service");
    const result = await getMissionControl(student);

    expect(result.profile.name).toBe("Anu");
    expect(result.mission).toMatchObject({ subject: "Biology", chapter: "Cell structure" });
    expect(mocks.prisma.missionTask.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { plan: { userId: student.id, active: true }, status: "TODO" } }));
  });

  it("does not fall back to Rahul demo data for incomplete production profiles", async () => {
    const { createMissionPlaceholder } = await import("@/server/student/service");
    const mission = createMissionPlaceholder({
      userId: student.id,
      name: "Anu",
      email: student.email,
      phone: null,
      targetExam: null,
      targetYear: null,
      dreamCollege: null,
      dailyStudyHours: null,
      onboardingCompleted: false,
    });

    expect(mission).toBeNull();
  });
});
