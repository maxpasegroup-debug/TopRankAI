import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { inspectProcess, parsePostgresTarget, verifyPostgresTarget } from "./postgres-target";
import type { WorkflowClient } from "./postgres-workflow";

// Official HTTPS distribution; the locally recorded digest is not a publisher checksum.
const archiveUrl = "https://get.enterprisedb.com/postgresql/postgresql-17.11-3-windows-x64-binaries.zip";
let phase = "approval";
function run(file: string, args: string[], capture = true) {
  const result = spawnSync(file, args, { encoding: "utf8", timeout: 90000, windowsHide: true, stdio: capture ? ["ignore", "pipe", "pipe"] : "ignore" });
  if (result.error || result.status !== 0) throw new Error("Setup command failed");
  return (result.stdout ?? "").trim();
}
const psQuote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 15432, exclusive: true }, () => server.close(error => error ? reject(error) : resolve()));
  });
}

try {
  if (process.platform !== "win32" || process.argv.slice(2).join(" ") !== "--create-disposable" || existsSync(".env.verification.local") || existsSync(".env.verification.pending.local")) throw new Error("Refused");
  const local = process.env.LOCALAPPDATA ?? "";
  const id = randomUUID().split("-").join("");
  const root = path.join(local, "TopRankVerify", "pg17-" + id);
  const database = "toprank_verify_" + id;
  const password = randomBytes(32).toString("hex");
  const adminPassword = randomBytes(32).toString("hex");
  const data = path.join(root, "data");
  if (!local || !path.isAbsolute(local) || existsSync(root)) throw new Error("Refused");
  // Run the same ambient-environment and endpoint checks before creating anything.
  const config: Record<string, string> = {
    TEST_DATABASE_URL: `postgresql://toprank_test_owner:${password}@127.0.0.1:15432/${database}?schema=public`,
    TOPRANK_TEST_TARGET: "dedicated-local-disposable", TOPRANK_TEST_TARGET_ID: id,
    TOPRANK_TEST_EXPECTED_DATA_DIRECTORY: data, TOPRANK_TEST_EXPECTED_SERVER_PID: "1", TOPRANK_TEST_READ_APPROVED: "true",
    AUTH_RATE_LIMIT_ACTIVATED: "false", AUTH_RATE_LIMIT_LIVE_VERIFIED: "false", AUTH_TRUSTED_PROXY_VERIFIED: "false",
  };
  parsePostgresTarget(config, process.env, local);
  await freePort();
  mkdirSync(root, { recursive: true });
  phase = "directory permissions";
  const account = run("whoami.exe", []);
  run("icacls.exe", [root, "/inheritance:r", "/grant:r", `${account}:(OI)(CI)F`]);
  phase = "official archive download";
  const archive = path.join(root, "postgresql.zip");
  const response = await fetch(archiveUrl, { redirect: "error", signal: AbortSignal.timeout(240000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > 600 * 1024 * 1024) throw new Error("Download refused");
  let bytes = 0;
  const hash = createHash("sha256");
  const bounded = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > 600 * 1024 * 1024) return callback(new Error("Archive limit"));
    hash.update(chunk); callback(null, chunk);
  } });
  await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), bounded, createWriteStream(archive, { flags: "wx", mode: 0o600 }));
  const archiveSha256 = hash.digest("hex");
  phase = "archive extraction";
  run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
    `$z=[IO.Compression.ZipFile]::OpenRead(${psQuote(archive)}); try { foreach($e in $z.Entries) { ` +
    "if($e.FullName -notmatch '^pgsql/' -or $e.FullName -match '(^|/)[.][.](/|$)' -or $e.FullName.Contains(':') -or $e.FullName.Contains([char]92)) { throw 'Unsafe archive entry' } } } finally {$z.Dispose()}; " +
    `[IO.Compression.ZipFile]::ExtractToDirectory(${psQuote(archive)},${psQuote(root)})`]);
  const bin = path.join(root, "pgsql", "bin");
  phase = "portable runtime version";
  if (!/^postgres \(PostgreSQL\) 17\./.test(run(path.join(bin, "postgres.exe"), ["--version"]))) throw new Error("Runtime mismatch");
  phase = "fresh cluster initialization";
  const pwfile = path.join(root, "bootstrap-password.tmp");
  writeFileSync(pwfile, adminPassword, { flag: "wx", mode: 0o600 });
  try { run(path.join(bin, "initdb.exe"), ["-D", data, "-U", "toprank_verify_admin", "--pwfile", pwfile, "--auth-host=scram-sha-256", "--auth-local=scram-sha-256", "--encoding=UTF8", "--locale=C"]); }
  finally { unlinkSync(pwfile); }
  writeFileSync(path.join(data, "pg_hba.conf"), "host all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n", { mode: 0o600 });
  await freePort();
  phase = "loopback-only startup";
  run(path.join(bin, "pg_ctl.exe"), ["-D", data, "-l", path.join(root, "server.log"), "-w", "-t", "30", "-o", "-h 127.0.0.1 -p 15432 -c max_connections=12 -c shared_buffers=32MB", "start"], false);
  config.TOPRANK_TEST_EXPECTED_SERVER_PID = readFileSync(path.join(data, "postmaster.pid"), "utf8").split(/\r?\n/)[0];
  const target = parsePostgresTarget(config, process.env, local);
  inspectProcess(target);
  phase = "fresh-server bootstrap";
  const { Client } = createRequire(import.meta.url)("pg") as { Client: new (config: object) => WorkflowClient };
  const client = new Client({ host: "127.0.0.1", port: 15432, database: "postgres", user: "toprank_verify_admin", password: adminPassword,
    ssl: false, connectionTimeoutMillis: 3000, query_timeout: 5000, application_name: "toprank-fresh-cluster-bootstrap" });
  try {
    await client.connect();
    const identity = (await client.query("SELECT current_setting('data_directory') AS directory, current_setting('server_version_num') AS version, current_user AS role")).rows[0];
    if (path.resolve(String(identity.directory)).toLowerCase() !== path.resolve(data).toLowerCase() || !/^17\d{4}$/.test(String(identity.version)) || identity.role !== "toprank_verify_admin") throw new Error("Identity mismatch");
    await client.query(`CREATE ROLE toprank_test_owner LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 8`);
    // Read server identity only in this fresh isolated cluster; no production roles.
    await client.query("GRANT pg_read_all_settings TO toprank_test_owner");
    await client.query(`CREATE DATABASE "${database}" OWNER toprank_test_owner TEMPLATE template0 ENCODING 'UTF8'`);
    await client.query(`REVOKE CONNECT ON DATABASE "${database}" FROM PUBLIC`);
  } finally { await client.end(); }
  const pending = ".env.verification.pending.local";
  if (existsSync(pending)) throw new Error("Pending configuration exists");
  writeFileSync(pending, Object.entries(config).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
  run("icacls.exe", [path.resolve(pending), "/inheritance:r", "/grant:r", account + ":F"]);
  phase = "empty-target identity verification";
  await verifyPostgresTarget(target);
  writeFileSync(path.join(root, "setup-receipt.json"), JSON.stringify({ targetId: id, source: archiveUrl, archiveSha256, createdAt: new Date().toISOString(), database, dataDirectory: data, pid: target.pid }, null, 2), { flag: "wx", mode: 0o600 });
  writeFileSync(".env.verification.local", Object.entries(config).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
  run("icacls.exe", [path.resolve(".env.verification.local"), "/inheritance:r", "/grant:r", account + ":F"]);
  unlinkSync(pending);
  console.log("Fresh local PostgreSQL 17 target created and verified empty; dedicated ignored configuration written. No migrations, fixtures, application activation or existing database access.");
} catch (error) {
  console.error(`Disposable setup stopped at ${phase}. No unknown database fallback or runtime installation. Preserve any fresh setup directory for review; secrets suppressed.`);
  if (error instanceof Error && /^Disposable PostgreSQL verification refused: [A-Za-z0-9 .,]+$/.test(error.message)) console.error(error.message);
  process.exitCode = 1;
}
