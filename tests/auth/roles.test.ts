import { describe, expect, it } from "vitest";
import { canAccessRole, parentRoles, platformAdminRoles, studentRoles } from "@/server/auth/roles";

describe("role authorization helpers", () => {
  it("allows matching student roles", () => {
    expect(canAccessRole("STUDENT", studentRoles)).toBe(true);
    expect(canAccessRole("PARENT", studentRoles)).toBe(false);
  });

  it("allows platform admins through privileged role groups", () => {
    expect(canAccessRole("PLATFORM_ADMIN", studentRoles)).toBe(true);
    expect(canAccessRole("PLATFORM_ADMIN", parentRoles)).toBe(true);
    expect(canAccessRole("PLATFORM_ADMIN", platformAdminRoles)).toBe(true);
  });

  it("keeps guardian accounts separate from candidate access", () => {
    expect(canAccessRole("PARENT", studentRoles)).toBe(false);
    expect(canAccessRole("PARENT", parentRoles)).toBe(true);
  });
});
