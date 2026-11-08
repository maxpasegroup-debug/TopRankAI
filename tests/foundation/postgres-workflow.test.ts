import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertDatabaseIdentity, parsePostgresTarget } from "../../verification/postgres-target";
import { checkMigrationHistory, isolatedChildEnvironment, migrationManifest, requireWriteApproval, rollbackFixtures, verifyMigratedTarget } from "../../verification/postgres-workflow";

const id = "a".repeat(32);
const local = path.resolve("test-fixtures-localappdata");
const target = () => parsePostgresTarget({
  TEST_DATABASE_URL: `postgresql://toprank_test_owner:synthetic@127.0.0.1:15432/toprank_verify_${id}?schema=public`,
  TOPRANK_TEST_TARGET: "dedicated-local-disposable", TOPRANK_TEST_TARGET_ID: id,
  TOPRANK_TEST_EXPECTED_DATA_DIRECTORY: path.join(local, "TopRankVerify", "pg17-" + id, "data"),
  TOPRANK_TEST_EXPECTED_SERVER_PID: "1234", TOPRANK_TEST_READ_APPROVED: "true",
  AUTH_RATE_LIMIT_ACTIVATED: "false", AUTH_RATE_LIMIT_LIVE_VERIFIED: "false", AUTH_TRUSTED_PROXY_VERIFIED: "false",
}, {}, local);
const identity = () => ({ database: target().database, user: "toprank_test_owner", owner: "toprank_test_owner",
  address: "127.0.0.1", port: 15432, directory: target().dataDirectory, version: "170011", schemas: "0", readOnly: "on",
  superuser: false, createDatabase: false, createRole: false });

describe("guarded disposable workflow (mocked, no database)", () => {
  it.each([[], ["migrate"], ["reset", "--approve-disposable-writes"], ["fixtures", "--approve-disposable-writes", "extra"]].map(args => ({ args })))("rejects missing or broadened write arguments $args", ({ args }) => {
    expect(() => requireWriteApproval(target(), args)).toThrow();
  });
  it("requires read approval as well as explicit write approval", () => {
    expect(() => requireWriteApproval({ ...target(), readApproved: false }, ["migrate", "--approve-disposable-writes"])).toThrow();
    expect(requireWriteApproval(target(), ["fixtures", "--approve-disposable-writes"])).toBe("fixtures");
  });
  it("does not weaken the original empty-schema assertion", () => {
    expect(() => assertDatabaseIdentity(target(), { ...identity(), objects: "1" })).toThrow();
    expect(() => assertDatabaseIdentity(target(), { ...identity(), objects: "0" })).not.toThrow();
  });
  it("isolates child processes from ambient production/provider settings", () => {
    const env = isolatedChildEnvironment(target(), { PATH: "synthetic-path", DATABASE_URL: "unknown", PGHOST: "unknown",
      RAILWAY_TOKEN: "synthetic", UPSTASH_REDIS_REST_TOKEN: "synthetic", NODE_OPTIONS: "untrusted", NODE_ENV: "production" });
    expect(env.DATABASE_URL).toBe(target().connectionString);
    expect(env.NODE_ENV).toBe("test");
    expect(env.PATH).toBe("synthetic-path");
    for (const key of ["PGHOST", "RAILWAY_TOKEN", "UPSTASH_REDIS_REST_TOKEN", "NODE_OPTIONS"]) expect(env[key]).toBeUndefined();
  });
  it("fingerprints the complete ordered migration history", () => {
    const rows = migrationManifest();
    expect(rows).toHaveLength(22);
    expect(rows.at(-1)?.name).toBe("20261108000100_email_otp_pin");
    expect(rows.every(row => /^[a-f0-9]{64}$/.test(row.checksum))).toBe(true);
    expect(rows.map(row => row.name)).toEqual(rows.map(row => row.name).sort());
  });
  it.each(["missing", "checksum", "failed", "rolledback", "extra"])("rejects %s migration history", kind => {
    const manifest = [{ name: "migration", checksum: "checksum" }];
    const valid = { migration_name: "migration", checksum: "checksum", finished_at: new Date(), rolled_back_at: null };
    const rows = kind === "missing" ? [] : kind === "extra" ? [valid, valid] : [{ ...valid,
      ...(kind === "checksum" ? { checksum: "other" } : kind === "failed" ? { finished_at: null } : { rolled_back_at: new Date() }) }];
    expect(() => checkMigrationHistory(manifest, rows)).toThrow();
  });
  it("checks migrated identity and history in a read-only transaction", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [identity()] })
      .mockResolvedValueOnce({ rows: [{ migration_name: "migration", checksum: "checksum", finished_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] }).mockResolvedValue({ rows: [] });
    await verifyMigratedTarget(target(), [{ name: "migration", checksum: "checksum" }], { connect: vi.fn(), end: vi.fn(), query });
    expect(query.mock.calls[0][0]).toBe("BEGIN READ ONLY");
    expect(query.mock.calls[1][0]).toContain("host(inet_server_addr()) AS address");
    expect(query.mock.calls.at(-1)![0]).toBe("ROLLBACK");
  });
  it("rolls back identity validation failure before fixtures", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ ...identity(), database: "unknown" }] }).mockResolvedValue({ rows: [] });
    await expect(verifyMigratedTarget(target(), [], { connect: vi.fn(), end: vi.fn(), query })).rejects.toThrow();
    expect(query.mock.calls.at(-1)![0]).toBe("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => /INSERT/.test(sql))).toBe(false);
  });
  it("bounds fixture writes and always rolls back, including constraint checks", async () => {
    const query = vi.fn(async (sql: string) => {
      if (/VALUES.*\('never'/.test(sql)) throw new Error("unreachable");
      if (/SELECT u.role/.test(sql)) return { rows: [{ role: "STUDENT" }] };
      if (/INSERT.*Duplicate/.test(sql)) throw Object.assign(new Error("duplicate"), { code: "23505" });
      if (/SELECT \(SELECT count/.test(sql)) return { rows: [{ count: "0" }] };
      return { rows: [] };
    });
    // Detect the duplicate by its parameter, not by interpolated SQL.
    const client = { connect: vi.fn(), end: vi.fn(), query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (values?.[3] === "Duplicate") throw Object.assign(new Error("duplicate"), { code: "23505" });
      return query(sql);
    }) };
    await rollbackFixtures(client);
    expect(client.query.mock.calls.filter(([sql]) => sql === "ROLLBACK")).toHaveLength(1);
    expect(client.query.mock.calls.some(([sql]) => /COMMIT|TRUNCATE|DROP|DELETE/.test(sql))).toBe(false);
    expect(client.query.mock.calls.at(-1)![0]).toContain('public."User"');
  });
  it("rolls back fixture failures without committing or cleaning other rows", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(rollbackFixtures({ connect: vi.fn(), end: vi.fn(), query })).rejects.toThrow();
    expect(query.mock.calls.at(-1)![0]).toBe("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => /COMMIT|DELETE|TRUNCATE|DROP/.test(sql))).toBe(false);
  });
  it("keeps verification Prisma configuration free of dotenv and seed hooks", () => {
    const config = readFileSync("verification/prisma.config.ts", "utf8");
    expect(config).not.toMatch(/import\s+["']dotenv|seed:/);
    expect(config).toContain("TOPRANK_VERIFICATION_CHILD");
  });
  it("CI has no deployment command or production credential reference", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain("contents: read");
    for (const command of ["npm test", "npm run typecheck", "validate --config", "npm run build"]) expect(workflow).toContain(command);
    expect(workflow).not.toMatch(/secrets\.|railway\s+(up|deploy)|migrate\s+(deploy|dev)|db:seed|pull_request_target/);
  });
});
