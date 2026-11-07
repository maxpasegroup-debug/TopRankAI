import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { assertDatabaseIdentity, assertProcessIdentity, parsePostgresTarget, verifyPostgresTarget } from "../../verification/postgres-target";

const id = "a".repeat(32);
const local = path.resolve("test-fixtures-localappdata");
const env = {
  TEST_DATABASE_URL: "postgresql://toprank_test_owner:synthetic-test-password@127.0.0.1:15432/toprank_verify_" + id + "?schema=public",
  TOPRANK_TEST_TARGET: "dedicated-local-disposable", TOPRANK_TEST_TARGET_ID: id,
  TOPRANK_TEST_EXPECTED_DATA_DIRECTORY: path.join(local, "TopRankVerify", "pg17-" + id, "data"),
  TOPRANK_TEST_EXPECTED_SERVER_PID: "1234", TOPRANK_TEST_READ_APPROVED: "true",
  AUTH_RATE_LIMIT_ACTIVATED: "false", AUTH_RATE_LIMIT_LIVE_VERIFIED: "false", AUTH_TRUSTED_PROXY_VERIFIED: "false",
};
const target = () => parsePostgresTarget(env, {}, local);
const row = () => ({ database: target().database, user: "toprank_test_owner", owner: "toprank_test_owner", address: "127.0.0.1", port: 15432, version: "170011", directory: target().dataDirectory, objects: "0", schemas: "0", readOnly: "on", superuser: false, createDatabase: false, createRole: false });

describe("dedicated PostgreSQL foundation guards (no live connections)", () => {
  it("accepts an exact dedicated configuration without making a connection", () => expect(target().database).toBe("toprank_verify_" + id));
  it.each(Object.keys(env))("rejects missing %s", key => { const input = { ...env } as Record<string, string>; delete input[key]; expect(() => parsePostgresTarget(input, {}, local)).toThrow(); });
  it.each(["DATABASE_URL", "TEST_DATABASE_URL", "PGHOST", "PGSERVICE", "PGPASSFILE", "TOPRANK_TEST_TARGET", "PAYMENT_PROVIDER_KEY", "AI_PROVIDER_API_KEY"])("rejects inherited %s", key => expect(() => parsePostgresTarget(env, { [key]: "conflict" }, local)).toThrow());
  it.each(["postgresql://toprank_test_owner:synthetic@localhost:15432/toprank_verify_", "postgresql://toprank_test_owner:synthetic@remote.example:15432/toprank_verify_", "postgresql://toprank_test_owner:synthetic@127.0.0.1:5432/toprank_verify_", "postgresql://admin:synthetic@127.0.0.1:15432/toprank_verify_"])("rejects alternate endpoint/role %s", prefix => expect(() => parsePostgresTarget({ ...env, TEST_DATABASE_URL: prefix + id + "?schema=public" }, {}, local)).toThrow());
  it.each(["&host=remote.example", "&schema=public", "&options=anything", "#fragment"])("rejects additional URL component %s", suffix => expect(() => parsePostgresTarget({ ...env, TEST_DATABASE_URL: env.TEST_DATABASE_URL + suffix }, {}, local)).toThrow());
  it("rejects unknown variables and production mode", () => {
    expect(() => parsePostgresTarget({ ...env, DATABASE_URL: "unknown" }, {}, local)).toThrow();
    expect(() => parsePostgresTarget(env, { NODE_ENV: "production" }, local)).toThrow();
    expect(() => parsePostgresTarget({ ...env, AUTH_RATE_LIMIT_ACTIVATED: "true" }, {}, local)).toThrow();
  });
  it("rejects a different data directory", () => expect(() => parsePostgresTarget({ ...env, TOPRANK_TEST_EXPECTED_DATA_DIRECTORY: path.resolve("ordinary-data") }, {}, local)).toThrow());
  it("rejects missing local root and malformed PID", () => {
    expect(() => parsePostgresTarget(env, {}, "")).toThrow();
    expect(() => parsePostgresTarget({ ...env, TOPRANK_TEST_EXPECTED_SERVER_PID: "1;malicious" }, {}, local)).toThrow();
  });
  it("requires exact process and loopback listener identity", () => {
    expect(() => assertProcessIdentity(target(), { executable: target().executable, listeners: [{ address: "127.0.0.1", pid: 1234 }] })).not.toThrow();
    for (const address of ["0.0.0.0", "::", "::1"]) expect(() => assertProcessIdentity(target(), { executable: target().executable, listeners: [{ address, pid: 1234 }] })).toThrow();
    expect(() => assertProcessIdentity(target(), { executable: target().executable, listeners: [{ address: "127.0.0.1", pid: 9876 }] })).toThrow();
    expect(() => assertProcessIdentity(target(), { executable: path.resolve("other-postgres.exe"), listeners: [] })).toThrow();
  });
  it.each(["database", "user", "owner", "address", "port", "version", "directory", "objects", "schemas", "readOnly", "superuser", "createDatabase", "createRole"])("rejects mismatched server field %s", key => expect(() => assertDatabaseIdentity(target(), { ...row(), [key]: "mismatch" })).toThrow());
  it("refuses before any client creation when read approval or OS identity is absent", async () => {
    const client = vi.fn();
    await expect(verifyPostgresTarget({ ...target(), readApproved: false }, { inspect: vi.fn(), client })).rejects.toThrow();
    await expect(verifyPostgresTarget(target(), { inspect: () => { throw new Error("Unknown process"); }, client })).rejects.toThrow();
    expect(client).not.toHaveBeenCalled();
  });
  it("uses only bounded read-only SQL and closes the mocked connection", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row()] });
    const end = vi.fn();
    await expect(verifyPostgresTarget(target(), { inspect: vi.fn(), client: () => ({ connect: vi.fn(), query, end }) })).resolves.toEqual({ verified: true, empty: true, readOnly: true });
    expect(query.mock.calls[0][0]).toBe("BEGIN READ ONLY");
    expect(query.mock.calls.at(-1)![0]).toBe("ROLLBACK");
    expect(query.mock.calls[1][0]).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i);
    expect(query.mock.calls[1][0]).toContain("host(inet_server_addr()) AS address");
    expect(query.mock.calls[1][0]).not.toContain("inet_server_addr()::text");
    expect(end).toHaveBeenCalledOnce();
  });
  it("suppresses credentials and closes the client on transport failure", async () => {
    const end = vi.fn();
    const action = verifyPostgresTarget(target(), { inspect: vi.fn(), client: () => ({ connect: vi.fn().mockRejectedValue(new Error(env.TEST_DATABASE_URL)), query: vi.fn(), end }) });
    await expect(action).rejects.toThrow("configuration or identity mismatch");
    expect(end).toHaveBeenCalledOnce();
  });
});
