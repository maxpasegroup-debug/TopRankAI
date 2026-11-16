import type { UserRole } from "@/generated/prisma/enums";

export const candidateRoles = ["CANDIDATE", "STUDENT"] as const;
export const userRoles = ["CANDIDATE", "STUDENT", "PARENT", "PLATFORM_ADMIN"] as const;

export type Role = (typeof userRoles)[number];

export function isRole(value: string): value is Role {
  return userRoles.includes(value as Role);
}

export function canAccessRole(userRole: UserRole | Role, allowedRoles: readonly (UserRole | Role)[]) {
  return allowedRoles.includes(userRole);
}

export const studentRoles = ["CANDIDATE", "STUDENT", "PLATFORM_ADMIN"] as const;
export const parentRoles = ["PARENT", "PLATFORM_ADMIN"] as const;
export const platformAdminRoles = ["PLATFORM_ADMIN"] as const;
