import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("practice revision unapplied migration contract, not PostgreSQL integration", () => {
  it("uses canonical owner/question keys and no historical alteration", () => {
    const sql = readFileSync("prisma/migrations/20261011000200_practice_revision/migration.sql", "utf8");
    expect(sql).toContain('PRIMARY KEY ("userId", "questionId")'); expect(sql).toContain('REFERENCES "User"'); expect(sql).toContain('REFERENCES "Question"'); expect(sql).not.toMatch(/^\s*(DROP|UPDATE|DELETE|TRUNCATE)\b/im);
  });
});
