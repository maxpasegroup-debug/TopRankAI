import { describe, expect, it } from "vitest";

describe.skipIf(process.env.TOPRANK_POSTGRES_READ_SUITE !== "true")("approved empty PostgreSQL target", () => {
  it("passed read-only identity and emptiness checks", () => {
    expect((globalThis as typeof globalThis & { postgresPreflight?: object }).postgresPreflight).toEqual({ verified: true, empty: true, readOnly: true });
  });
});
