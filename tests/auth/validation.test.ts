import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/server/auth/validation";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
const consent = { country: "IN", ageBand: "18_PLUS", termsAccepted: true, privacyAccepted: true, termsVersion: ACCOUNT_POLICY_VERSION, privacyVersion: ACCOUNT_POLICY_VERSION };

describe("auth validation", () => {
  it("normalizes signup email and defaults to student role", () => {
    const result = signupSchema.parse({
      name: "Rahul",
      email: "RAHUL@example.com",
      password: "password123",
      ...consent,
    });

    expect(result.email).toBe("rahul@example.com");
    expect(result.role).toBe("STUDENT");
  });

  it("rejects short passwords", () => {
    expect(() =>
      signupSchema.parse({
        name: "Rahul",
        email: "rahul@example.com",
        password: "short",
      }),
    ).toThrow();
  });

  it("accepts an explicit student role", () => {
    expect(signupSchema.parse({ name: "Rahul", email: "rahul@example.com", password: "password123", role: "STUDENT", ...consent }).role).toBe("STUDENT");
  });

  it.each(["PLATFORM_ADMIN", "TEACHER", "PARENT", "SCHOOL_ADMIN"])("rejects public signup with role %s", (role) => {
    expect(() => signupSchema.parse({ name: "Rahul", email: "rahul@example.com", password: "password123", role })).toThrow();
  });

  it("validates login input", () => {
    expect(loginSchema.parse({ email: "a@b.com", password: "secret" })).toEqual({
      email: "a@b.com",
      password: "secret",
    });
  });
});
