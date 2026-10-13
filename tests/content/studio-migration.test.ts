import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("prisma/migrations/20261010000800_content_knowledge_studio/migration.sql", "utf8");
describe("Studio forward-only migration contract (not PostgreSQL execution)", () => {
  it("adds only the three governance models without rewriting canonical content", () => { expect(sql.match(/CREATE TABLE/g)).toHaveLength(3); expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE FROM|UPDATE "(?:Exam|Lesson|Question)"/); });
  it("binds canonical exams, succession, authors, reviewers and requesters with restrictive foreign keys", () => { for (const name of ["examId", "supersedesId", "authorId", "reviewerId", "sourceId", "requestedById"]) expect(sql).toContain(`FOREIGN KEY ("${name}")`); expect(sql).not.toContain("ON DELETE CASCADE"); });
  it("deduplicates source-version requests and forbids success without completion evidence", () => { expect(sql).toContain('ON "ContentKnowledgeJob"("sourceId", "fingerprint")'); expect(sql).toContain('"state" <> \'SUCCEEDED\' OR "completedAt" IS NOT NULL'); expect(sql).toContain('"decision" IS NOT NULL'); });
});
