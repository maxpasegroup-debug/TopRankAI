import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration = readFileSync("prisma/migrations/20261011000300_engagement_support/migration.sql", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
describe("Phase 8 forward-only migration contract (no database)", () => {
  it("adds a support CAS version with a safe default", () => { expect(migration).toContain('ALTER TABLE "HelpRequest" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0'); });
  it("does not fabricate verification of historical competitions", () => { expect(migration).toContain('ADD COLUMN "resultsVerifiedAt" TIMESTAMP(3)'); expect(migration).not.toMatch(/UPDATE|INSERT|DELETE|DROP|TRUNCATE/i); });
  it("indexes the existing owner-scoped inbox rather than creating another notification table", () => { expect(migration).toContain('ON "CommerceNotification" ("userId", "channel", "status", "createdAt")'); expect(migration).not.toContain("CREATE TABLE"); expect(schema).toContain('map: "CommerceNotification_inbox_idx"'); });
});
