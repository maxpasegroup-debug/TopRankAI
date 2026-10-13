import { loadPostgresTarget, verifyPostgresTarget } from "./verification/postgres-target";

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && args[0] !== "--connect") throw new Error("Unsupported arguments");
  const target = loadPostgresTarget();
  if (args[0] === "--connect") {
    await verifyPostgresTarget(target);
    console.log("Approved disposable PostgreSQL identity and empty schema verified read-only.");
  } else console.log("Dedicated configuration validated offline. No connection made; isolation is not yet verified.");
} catch {
  console.error("PostgreSQL preflight refused. Complete the dedicated configuration and identity checklist in LAUNCH_FOUNDATION.md. Secret diagnostics are suppressed.");
  process.exitCode = 1;
}
