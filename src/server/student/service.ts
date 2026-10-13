import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import type { AuthUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import type { StudentProfileUpdateInput } from "./validation";

export type SupportedExamDto = {
  id: string;
  code: string;
  name: string;
};

export type StudentProfileDto = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  targetExam: SupportedExamDto | null;
  targetYear: number | null;
  dreamCollege: string | null;
  dailyStudyHours: number | null;
  onboardingCompleted: boolean;
};

export type StudentMissionDto = {
  subject: string;
  chapter: string;
  durationMinutes: number;
  href: string;
};

export const supportedExamCodes = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "KEAM", "CUET"] as const;

export function assertStudent(user: AuthUser) {
  if (user.role !== "STUDENT") {
    throw new AuthorizationApiError("Only student accounts can access this resource");
  }
  if (user.requiresLegalConsent) throw new AuthorizationApiError("Complete your account consent before continuing");
}

function toHours(minutes: number | null) {
  return minutes === null ? null : minutes / 60;
}

function toProfileDto(profile: Awaited<ReturnType<typeof getStudentProfileRecord>>): StudentProfileDto {
  if (!profile) {
    throw new ValidationApiError("Student profile does not exist");
  }

  return {
    userId: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.user.phone,
    targetExam: profile.targetExam
      ? {
          id: profile.targetExam.id,
          code: profile.targetExam.code,
          name: profile.targetExam.name,
        }
      : null,
    targetYear: profile.targetYear,
    dreamCollege: profile.dreamCollege,
    dailyStudyHours: toHours(profile.dailyStudyMins),
    onboardingCompleted: Boolean(profile.onboardingCompletedAt),
  };
}

export function isStudentOnboardingComplete(profile: Pick<StudentProfileDto, "targetExam" | "targetYear" | "dreamCollege" | "dailyStudyHours" | "onboardingCompleted">) {
  return Boolean(
    profile.onboardingCompleted &&
      profile.targetExam &&
      profile.targetYear &&
      profile.dreamCollege &&
      profile.dailyStudyHours,
  );
}

export function createMissionPlaceholder(profile: StudentProfileDto): StudentMissionDto | null {
  if (!isStudentOnboardingComplete(profile)) {
    return null;
  }

  const subject = profile.targetExam?.code === "CUET" ? "General Test" : "Physics";
  const chapter = profile.targetExam?.code === "CUET" ? "Quantitative Aptitude" : "Motion";
  const durationMinutes = Math.max(30, Math.min(90, Math.round((profile.dailyStudyHours ?? 1) * 30)));

  return {
    subject,
    chapter,
    durationMinutes,
    href: "/learn/physics/motion-in-a-straight-line/distance-and-displacement",
  };
}

async function getStudentProfileRecord(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      targetExam: true,
    },
  });
}

export async function listSupportedExams(): Promise<SupportedExamDto[]> {
  const exams = await prisma.exam.findMany({
    where: {
      status: "PUBLISHED",
      active: true,
    },
    orderBy: [{ code: "asc" }],
  });

  return exams.map((exam) => ({ id: exam.id, code: exam.code, name: exam.name }));
}

export async function getStudentProfile(user: AuthUser): Promise<StudentProfileDto> {
  assertStudent(user);

  const profile = await getStudentProfileRecord(user.id);

  return toProfileDto(profile);
}

export async function getOnboardingStatus(user: AuthUser) {
  const profile = await getStudentProfile(user);

  return {
    completed: isStudentOnboardingComplete(profile),
    profile,
  };
}

export async function updateStudentProfile(user: AuthUser, input: StudentProfileUpdateInput): Promise<StudentProfileDto> {
  assertStudent(user);
  if (input.completeOnboarding) throw new ValidationApiError("Confirm your mission plan to finish onboarding");

  if (input.targetExamId) {
    const exam = await prisma.exam.findFirst({
      where: {
        id: input.targetExamId,
        status: "PUBLISHED",
        active: true,
      },
    });

    if (!exam) {
      throw new ValidationApiError("Selected exam is not supported");
    }
  }

  const dailyStudyMins =
    input.dailyStudyHours === undefined ? undefined : Math.round(input.dailyStudyHours * 60);

  const profile = await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.phone !== undefined) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: input.name,
          phone: input.phone === "" ? null : input.phone,
        },
      });
    }

    return tx.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        targetExamId: input.targetExamId,
        targetYear: input.targetYear,
        dreamCollege: input.dreamCollege,
        dailyStudyMins,
        onboardingCompletedAt: undefined,
      },
      create: {
        userId: user.id,
        targetExamId: input.targetExamId,
        targetYear: input.targetYear,
        dreamCollege: input.dreamCollege,
        dailyStudyMins,
        onboardingCompletedAt: undefined,
      },
      include: {
        user: true,
        targetExam: true,
      },
    });
  });

  return toProfileDto(profile);
}

export async function getMissionControl(user: AuthUser) {
  const profile = await getStudentProfile(user);
  const task = await prisma.missionTask.findFirst({ where: { plan: { userId: user.id, active: true }, status: "TODO" },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }], select: { subject: true, title: true, minutes: true, href: true } });

  return {
    profile,
    mission: task?.href ? { subject: task.subject, chapter: task.title, durationMinutes: task.minutes, href: task.href } : null,
  };
}
