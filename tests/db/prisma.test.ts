import { describe, expect, it } from "vitest";

describe("Prisma client foundation", () => {
  it("exposes foundation models", async () => {
    process.env.DATABASE_URL ??= "postgresql://toprank:toprank@localhost:5432/toprank_test?schema=public";
    const { prisma } = await import("@/server/db");

    expect(prisma.user).toBeDefined();
    expect(prisma.candidateExamTarget).toBeDefined();
    expect(prisma.exam).toBeDefined();
    expect(prisma.lesson).toBeDefined();
    expect(prisma.learningResource).toBeDefined();
  });
});
