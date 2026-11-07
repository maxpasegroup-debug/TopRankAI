import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseEnv } from "node:util";

type Environment = Record<string, string | undefined>;
export type PostgresTarget = {
  connectionString: string; database: string; dataDirectory: string;
  executable: string; pid: number; readApproved: boolean;
};
export interface ReadClient {
  connect(): Promise<unknown>;
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<unknown>;
}
const disabled = ["AUTH_RATE_LIMIT_ACTIVATED", "AUTH_RATE_LIMIT_LIVE_VERIFIED", "AUTH_TRUSTED_PROXY_VERIFIED"] as const;
const keys = new Set(["TEST_DATABASE_URL", "TOPRANK_TEST_TARGET", "TOPRANK_TEST_TARGET_ID", "TOPRANK_TEST_EXPECTED_DATA_DIRECTORY", "TOPRANK_TEST_EXPECTED_SERVER_PID", "TOPRANK_TEST_READ_APPROVED", ...disabled]);
function refuse(): never {
  throw new Error("Disposable PostgreSQL verification refused: configuration or identity mismatch.");
}
function normalized(value: string) {
  return path.resolve(value).replace(/\\/g, "/").toLowerCase();
}

export function parsePostgresTarget(env: Environment, inherited: Environment, localAppData: string): PostgresTarget {
  if (!localAppData || !path.isAbsolute(localAppData)) refuse();
  if (Object.keys(env).some(key => !keys.has(key))) refuse();
  if (Object.keys(inherited).some(key => /^(PG|DATABASE_URL$|TEST_DATABASE_URL$|TOPRANK_TEST_)/.test(key) ||
      /(?:DATABASE|POSTGRES).*URL/.test(key) ||
      /(?:PROVIDER|PAYMENT|RAZORPAY|UPSTASH|REDIS|AI_|EMAIL_|WHATSAPP)/.test(key) && Boolean(inherited[key]) ||
      disabled.includes(key as typeof disabled[number]) && inherited[key] !== "false" && inherited[key] !== undefined)) refuse();
  if (inherited.NODE_ENV === "production" || disabled.some(key => env[key] !== "false")) refuse();
  if (env.TOPRANK_TEST_TARGET !== "dedicated-local-disposable" || !/^[a-f0-9]{32}$/.test(env.TOPRANK_TEST_TARGET_ID ?? "")) refuse();
  if (!/^[1-9]\d{0,9}$/.test(env.TOPRANK_TEST_EXPECTED_SERVER_PID ?? "") || !["true", "false"].includes(env.TOPRANK_TEST_READ_APPROVED ?? "")) refuse();
  const root = path.join(localAppData, "TopRankVerify", "pg17-" + env.TOPRANK_TEST_TARGET_ID);
  const dataDirectory = path.join(root, "data");
  if (!env.TOPRANK_TEST_EXPECTED_DATA_DIRECTORY || !path.isAbsolute(env.TOPRANK_TEST_EXPECTED_DATA_DIRECTORY) || normalized(env.TOPRANK_TEST_EXPECTED_DATA_DIRECTORY) !== normalized(dataDirectory)) refuse();
  let url: URL;
  try { url = new URL(env.TEST_DATABASE_URL ?? ""); } catch { refuse(); }
  const database = "toprank_verify_" + env.TOPRANK_TEST_TARGET_ID;
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "15432" || url.username !== "toprank_test_owner" || !url.password || url.pathname !== "/" + database || url.hash || [...url.searchParams].length !== 1 || url.searchParams.get("schema") !== "public") refuse();
  try { decodeURIComponent(url.password); } catch { refuse(); }
  return { connectionString: env.TEST_DATABASE_URL!, database, dataDirectory, executable: path.join(root, "pgsql", "bin", "postgres.exe"), pid: Number(env.TOPRANK_TEST_EXPECTED_SERVER_PID), readApproved: env.TOPRANK_TEST_READ_APPROVED === "true" };
}

export function loadPostgresTarget() {
  try { return parsePostgresTarget(parseEnv(readFileSync(path.resolve(".env.verification.local"), "utf8")), process.env, process.env.LOCALAPPDATA ?? ""); }
  catch { refuse(); }
}

export function assertProcessIdentity(target: PostgresTarget, inventory: { executable: string; listeners: { address: string; pid: number }[] }) {
  if (normalized(inventory.executable) !== normalized(target.executable)) throw new Error("Disposable PostgreSQL verification refused: process executable mismatch.");
  if (!inventory.listeners.length) throw new Error("Disposable PostgreSQL verification refused: process listener absent.");
  if (inventory.listeners.some(item => item.address !== "127.0.0.1" || item.pid !== target.pid)) throw new Error("Disposable PostgreSQL verification refused: process listener mismatch.");
}

export function inspectProcess(target: PostgresTarget) {
  if (process.platform !== "win32") refuse();
  try {
    if (readFileSync(path.join(target.dataDirectory, "PG_VERSION"), "utf8").trim() !== "17" || normalized(realpathSync(target.dataDirectory)) !== normalized(target.dataDirectory) || normalized(realpathSync(target.executable)) !== normalized(target.executable)) refuse();
    const command = "$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter \"ProcessId=" + target.pid + "\"; $l=@(Get-NetTCPConnection -State Listen -LocalPort 15432 -ErrorAction Stop); @{executable=$p.ExecutablePath;listeners=@($l | ForEach-Object {@{address=$_.LocalAddress;pid=$_.OwningProcess}})} | ConvertTo-Json -Compress -Depth 4";
    assertProcessIdentity(target, JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", timeout: 30000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })));
  } catch (error) {
    if (error instanceof Error && /^Disposable PostgreSQL verification refused: process [A-Za-z ]+[.]$/.test(error.message)) throw error;
    if ((error as { code?: string }).code === "ETIMEDOUT") throw new Error("Disposable PostgreSQL verification refused: OS inspection timed out.");
    refuse();
  }
}

export function assertServerIdentity(target: PostgresTarget, row: Record<string, unknown>) {
  const checks: Record<string, boolean> = {
    database: row.database === target.database, user: row.user === "toprank_test_owner", owner: row.owner === "toprank_test_owner",
    address: row.address === "127.0.0.1", port: Number(row.port) === 15432, version: /^17\d{4}$/.test(String(row.version)),
    directory: typeof row.directory === "string" && normalized(row.directory) === normalized(target.dataDirectory),
    schemas: Number(row.schemas) === 0, readOnly: row.readOnly === "on", superuser: row.superuser === false,
    createDatabase: row.createDatabase === false, createRole: row.createRole === false,
  };
  for (const [field, matches] of Object.entries(checks)) {
    if (!matches) throw new Error("Disposable PostgreSQL verification refused: server field " + field + " mismatch.");
  }
}

export function assertDatabaseIdentity(target: PostgresTarget, row: Record<string, unknown>) {
  assertServerIdentity(target, row);
  if (Number(row.objects) !== 0) throw new Error("Disposable PostgreSQL verification refused: empty schema mismatch.");
}

export async function verifyPostgresTarget(target: PostgresTarget, dependencies?: { inspect: (target: PostgresTarget) => void; client: (target: PostgresTarget) => ReadClient }) {
  if (!target.readApproved) refuse();
  (dependencies?.inspect ?? inspectProcess)(target);
  const client = dependencies ? dependencies.client(target) : (() => {
    const { Client } = createRequire(import.meta.url)("pg") as { Client: new (config: object) => ReadClient };
    return new Client({ connectionString: target.connectionString, ssl: false, connectionTimeoutMillis: 3000, query_timeout: 3000, statement_timeout: 3000, application_name: "toprank-phase1-read-only", options: "-c default_transaction_read_only=on" });
  })();
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query([
      "SELECT current_database() AS database, current_user AS \"user\", host(inet_server_addr()) AS address, inet_server_port() AS port,",
      "current_setting('data_directory') AS directory, current_setting('server_version_num') AS version, current_setting('transaction_read_only') AS \"readOnly\",",
      "(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner,",
      "(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser, (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS \"createDatabase\", (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS \"createRole\",",
      "(SELECT count(*) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema')) AS schemas,",
      "((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema') +",
      "(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema') +",
      "(SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema')) AS objects",
    ].join(" "));
    if (rows.length !== 1) refuse();
    assertDatabaseIdentity(target, rows[0]);
    await client.query("ROLLBACK");
    return { verified: true, empty: true, readOnly: true } as const;
  } catch (error) {
    if (error instanceof Error && /^Disposable PostgreSQL verification refused: (?:server field [A-Za-z]+ mismatch|empty schema mismatch|configuration or identity mismatch)[.]$/.test(error.message)) throw error;
    const code = (error as { code?: string }).code;
    if (code && /^(?:[0-9A-Z]{5}|EACCES|ETIMEDOUT|ECONNREFUSED)$/.test(code)) {
      throw new Error("Disposable PostgreSQL verification refused: metadata transport code " + code + ".");
    }
    refuse();
  }
  finally { try { await client.end(); } catch { /* Never expose transport credentials. */ } }
}
