import { loadPostgresTarget } from "./postgres-target";
import { runDatabaseWorkflow } from "./postgres-workflow";

try {
  const action = await runDatabaseWorkflow(loadPostgresTarget(), process.argv.slice(2));
  console.log(action === "migrate" ? "Dedicated target migration history verified." : "Dedicated target rollback-only persistence fixtures passed; no fixture rows retained.");
} catch (error) {
  console.error("Disposable database workflow refused or failed. Preserve the cluster; review the infrastructure report. Secrets suppressed.");
  if (error instanceof Error && /^Disposable migration failed: [A-Za-z0-9_ .]+$/.test(error.message)) console.error(error.message);
  process.exitCode = 1;
}
