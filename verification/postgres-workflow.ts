import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { assertServerIdentity, inspectProcess, type PostgresTarget, verifyPostgresTarget } from "./postgres-target";

type Migration = { name: string; checksum: string };
type Row = Record<string, unknown>;
export interface WorkflowClient {
  connect(): Promise<unknown>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<unknown>;
}
export function refuseWorkflow(): never { throw new Error("Disposable database workflow refused; secret diagnostics suppressed."); }
export function requireWriteApproval(target: PostgresTarget, args: string[]) {
  if (!target.readApproved || args.length !== 2 || args[1] !== "--approve-disposable-writes" || !["migrate", "fixtures"].includes(args[0])) refuseWorkflow();
  return args[0] as "migrate" | "fixtures";
}
export function migrationManifest(root = path.resolve("prisma/migrations")): Migration[] {
  const names = readdirSync(root, { withFileTypes: true }).filter(row => row.isDirectory()).map(row => row.name).sort();
  if (!names.length || names.some(name => !/^\d{14}_[a-z0-9_]+$/.test(name))) refuseWorkflow();
  return names.map(name => ({ name, checksum: createHash("sha256").update(readFileSync(path.join(root, name, "migration.sql"))).digest("hex") }));
}
export function checkMigrationHistory(expected: Migration[], rows: Row[]) {
  if (rows.length !== expected.length || rows.some((row, i) => row.migration_name !== expected[i].name || row.checksum !== expected[i].checksum || !row.finished_at || row.rolled_back_at)) refuseWorkflow();
}
export function isolatedChildEnvironment(target: PostgresTarget, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "COMSPEC", "PATHEXT"]) {
    if (inherited[key]) env[key] = inherited[key];
  }
  return { ...env, NODE_ENV: "test", DATABASE_URL: target.connectionString, TOPRANK_VERIFICATION_CHILD: "true",
    AUTH_RATE_LIMIT_ACTIVATED: "false", AUTH_RATE_LIMIT_LIVE_VERIFIED: "false", AUTH_TRUSTED_PROXY_VERIFIED: "false" };
}
function makeClient(target: PostgresTarget): WorkflowClient {
  const { Client } = createRequire(import.meta.url)("pg") as { Client: new (config: object) => WorkflowClient };
  return new Client({ connectionString: target.connectionString, ssl: false, connectionTimeoutMillis: 3000,
    query_timeout: 10000, statement_timeout: 8000, application_name: "toprank-disposable-verification" });
}
const identitySql = `SELECT current_database() AS database, current_user AS "user", host(inet_server_addr()) AS address,
  inet_server_port() AS port, current_setting('data_directory') AS directory, current_setting('server_version_num') AS version,
  current_setting('transaction_read_only') AS "readOnly",
  (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner,
  (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
  (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS "createDatabase",
  (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS "createRole",
  (SELECT count(*) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema')) AS schemas`;
function receiptPath(target: PostgresTarget) { return path.join(path.dirname(target.dataDirectory), "migration-receipt.json"); }
function manifestHash(manifest: Migration[]) { return createHash("sha256").update(JSON.stringify(manifest)).digest("hex"); }
export async function verifyMigratedTarget(target: PostgresTarget, manifest: Migration[], client: WorkflowClient) {
  await client.query("BEGIN READ ONLY");
  try {
    const identity = await client.query(identitySql);
    if (identity.rows.length !== 1) refuseWorkflow();
    assertServerIdentity(target, identity.rows[0]);
    const history = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
    checkMigrationHistory(manifest, history.rows);
    const foreign = await client.query("SELECT count(*) AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)");
    if (Number(foreign.rows[0]?.count) !== 0) refuseWorkflow();
  } finally { await client.query("ROLLBACK"); }
}
export async function rollbackFixtures(client: WorkflowClient) {
  const id = "verify_" + randomUUID();
  const email = id + "@example.invalid";
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout='5s'");
    await client.query(`INSERT INTO public."User" (id,email,"passwordHash",name,role,status,"updatedAt") VALUES ($1,$2,$3,$4,'STUDENT','ACTIVE',now())`,
      [id, email, "synthetic-non-login-fixture", "Disposable fixture"]);
    await client.query(`INSERT INTO public."StudentProfile" (id,"userId","updatedAt") VALUES ($1,$2,now())`, [id, id]);
    const tokenHash = createHash("sha256").update(randomUUID()).digest("hex");
    await client.query(`INSERT INTO public."Session" (id,"userId","tokenHash","expiresAt","updatedAt") VALUES ($1,$2,$3,now()+interval '5 minutes',now())`, [id, id, tokenHash]);
    const joined = await client.query(`SELECT u.role FROM public."User" u JOIN public."StudentProfile" p ON p."userId"=u.id JOIN public."Session" s ON s."userId"=u.id WHERE u.id=$1`, [id]);
    if (joined.rows.length !== 1 || joined.rows[0].role !== "STUDENT") refuseWorkflow();
    await client.query("SAVEPOINT duplicate_check");
    let rejected = false;
    try { await client.query(`INSERT INTO public."User" (id,email,"passwordHash",name,role,"updatedAt") VALUES ($1,$2,$3,$4,'STUDENT',now())`, [id + "_duplicate", email, "synthetic", "Duplicate"]); }
    catch (error) { if ((error as { code?: string }).code !== "23505") throw error; rejected = true; }
    await client.query("ROLLBACK TO SAVEPOINT duplicate_check");
    if (!rejected) refuseWorkflow();
  } finally { await client.query("ROLLBACK"); }
  const remaining = await client.query(`SELECT (SELECT count(*) FROM public."User" WHERE id=$1)+(SELECT count(*) FROM public."StudentProfile" WHERE id=$1)+(SELECT count(*) FROM public."Session" WHERE id=$1) AS count`, [id]);
  if (Number(remaining.rows[0]?.count) !== 0) refuseWorkflow();
}
export async function runDatabaseWorkflow(target: PostgresTarget, args: string[]) {
  const action = requireWriteApproval(target, args);
  const manifest = migrationManifest();
  if (action === "migrate") {
    // First writes require the original EMPTY-target guard, never a populated fallback.
    await verifyPostgresTarget(target);
    if (existsSync(receiptPath(target))) refuseWorkflow();
    inspectProcess(target);
    const child = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "verification/prisma.config.ts"],
      { env: isolatedChildEnvironment(target), encoding: "utf8", timeout: 120000, windowsHide: true });
    if (child.error || child.status !== 0) {
      const output = (child.stderr ?? "") + "\n" + (child.stdout ?? "");
      const prisma = output.match(/\bP\d{4}\b/)?.[0] ?? "UNKNOWN";
      const sql = output.match(/Database error code:\s*([0-9A-Z]{5})/)?.[1] ?? "UNKNOWN";
      const migration = output.match(/Migration name:\s*(\d{14}_[a-z0-9_]+)/)?.[1] ?? "UNKNOWN";
      throw new Error("Disposable migration failed: " + prisma + " SQL " + sql + " migration " + migration + ".");
    }
  } else {
    const receipt = JSON.parse(readFileSync(receiptPath(target), "utf8"));
    if (receipt.database !== target.database || receipt.manifest !== manifestHash(manifest)) refuseWorkflow();
  }
  inspectProcess(target);
  const client = makeClient(target);
  try {
    await client.connect();
    await verifyMigratedTarget(target, manifest, client);
    if (action === "fixtures") await rollbackFixtures(client);
    else writeFileSync(receiptPath(target), JSON.stringify({ database: target.database, manifest: manifestHash(manifest), completedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
  } catch { refuseWorkflow(); }
  finally { try { await client.end(); } catch { /* No connection details in diagnostics. */ } }
  return action;
}
