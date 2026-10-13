import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../prisma/migrations/20261010000500_portal_scope_integrity/migration.sql", import.meta.url), "utf8");

describe("forward consent migration text contract (not PostgreSQL execution)", () => {
  it.each([
    ["SchoolEnrollment", "SchoolEnrollment_active_scopes_check", "6"],
    ["StudentParentRelationship", "Guardian_active_scopes_check", "4"],
  ])("requires explicit bounded non-null scopes for ACTIVE %s", (table, constraint, maximum) => {
    const statement = sql.split(";").find(part => part.includes(`ADD CONSTRAINT "${constraint}"`))!;
    expect(statement).toContain(`ALTER TABLE "${table}"`);
    expect(statement).toContain('"status"::text <> \'ACTIVE\'');
    expect(statement).toContain('"scopes" IS NOT NULL');
    expect(statement).toContain(`cardinality("scopes") BETWEEN 1 AND ${maximum}`);
    expect(statement).toContain('array_ndims("scopes") = 1');
    expect(statement).toContain('array_position("scopes", NULL::text) IS NULL');
    expect(statement).toContain("NOT VALID");
  });
  it("does not assign support/counselling scopes to guardians", () => {
    const statement = sql.split(";").find(part => part.includes('ADD CONSTRAINT "Guardian_active_scopes_check"'))!;
    expect(statement).not.toMatch(/SUPPORT|COUNSELLING/);
    expect(statement).toContain("'ANNOUNCEMENTS'");
  });
  it("contains no data changes, historical constraint removal or automatic validation", () => {
    const statements = sql.replace(/--[^\n]*/g, "");
    expect(statements).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|VALIDATE)\b/i);
    expect((statements.match(/ADD CONSTRAINT/g) ?? [])).toHaveLength(2);
  });
  it("pins the existing PostgreSQL provider in the migration lock", () => {
    expect(readFileSync(new URL("../../prisma/migrations/migration_lock.toml", import.meta.url), "utf8").trim()).toBe('provider = "postgresql"');
  });
});
