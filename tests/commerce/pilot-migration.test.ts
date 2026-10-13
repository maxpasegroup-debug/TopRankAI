import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("prisma/migrations/20261013000100_free_pilot_packages/migration.sql", "utf8");
const original = readFileSync("prisma/migrations/20261010000300_commerce_foundation/migration.sql", "utf8");
describe("free-pilot forward migration contract (not PostgreSQL execution)", () => {
  it("allows only package price zero and fixed free access", () => { expect(sql).toContain('"amountMinor" BETWEEN 0 AND 100000000'); expect(sql).toContain('("amountMinor" > 0 OR "interval" = \'ONCE\')'); });
  it("retains all package validity invariants atomically", () => { for (const part of ['BEGIN;', 'COMMIT;', '"revision" > 0', '"durationDays" BETWEEN 1 AND 3660', '"availableUntil" > "availableFrom"', 'cardinality("features") BETWEEN 1 AND 30', '"currency" = \'INR\'']) expect(sql).toContain(part); });
  it("does not alter positive-money tables or immutable triggers, or modify any data", () => { expect(sql).not.toMatch(/ALTER TABLE "(CommerceOrder|CommercePayment|CommerceReceipt|CommerceRefund)"|DROP TABLE|UPDATE |INSERT INTO|DELETE FROM|TRUNCATE|DROP TRIGGER/i); expect(original).toContain('"amountMinor" BETWEEN 1 AND 100000000'); });
});
