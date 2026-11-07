import { spawnSync } from "node:child_process";
import path from "node:path";
import { inspectProcess, loadPostgresTarget } from "./postgres-target";

try {
  if (process.argv.slice(2).join(" ") !== "--stop-owned-target") throw new Error("Approval required");
  const target = loadPostgresTarget();
  inspectProcess(target);
  const result = spawnSync(path.join(path.dirname(target.executable), "pg_ctl.exe"),
    ["-D", target.dataDirectory, "-w", "-t", "30", "-m", "fast", "stop"],
    { stdio: "ignore", windowsHide: true, timeout: 40000 });
  if (result.error || result.status !== 0) throw new Error("Stop failed");
  console.log("Owned disposable PostgreSQL process stopped; all files preserved. No database query.");
} catch {
  console.error("Disposable PostgreSQL stop refused or failed; identity approval required. Secrets suppressed.");
  process.exitCode = 1;
}
