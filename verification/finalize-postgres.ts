import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { parsePostgresTarget, verifyPostgresTarget } from "./postgres-target";

try {
  if (process.argv.slice(2).join(" ") !== "--verify-pending-setup" || existsSync(".env.verification.local")) throw new Error("Refused");
  const pending = ".env.verification.pending.local";
  const raw = readFileSync(pending, "utf8");
  const config = parseEnv(raw);
  const target = parsePostgresTarget(config, process.env, process.env.LOCALAPPDATA ?? "");
  await verifyPostgresTarget(target);
  const root = path.dirname(target.dataDirectory);
  const archive = path.join(root, "postgresql.zip");
  if (statSync(archive).size > 600 * 1024 * 1024) throw new Error("Refused");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  writeFileSync(path.join(root, "setup-receipt.json"), JSON.stringify({ targetId: config.TOPRANK_TEST_TARGET_ID,
    source: "https://get.enterprisedb.com/postgresql/postgresql-17.11-3-windows-x64-binaries.zip",
    archiveSha256: hash.digest("hex"), digestRecordedAtFinalization: true, createdAt: new Date().toISOString(),
    database: target.database, dataDirectory: target.dataDirectory, pid: target.pid }), { flag: "wx", mode: 0o600 });
  writeFileSync(".env.verification.local", raw, { flag: "wx", mode: 0o600 });
  const who = spawnSync("whoami.exe", [], { encoding: "utf8", windowsHide: true });
  if (who.error || who.status !== 0) throw new Error("Refused");
  const acl = spawnSync("icacls.exe", [path.resolve(".env.verification.local"), "/inheritance:r", "/grant:r", who.stdout.trim() + ":F"], { stdio: "ignore", windowsHide: true });
  if (acl.error || acl.status !== 0) throw new Error("Refused");
  unlinkSync(pending);
  console.log("Pending fresh setup verified EMPTY and finalized; protected dedicated configuration written. No database writes or migrations.");
} catch {
  console.error("Pending setup finalization refused or failed; preserve the target and inspect safe diagnostics. Secrets suppressed.");
  process.exitCode = 1;
}
