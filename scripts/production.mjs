import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const prisma = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

function executeStep(executable, args, options) {
  return new Promise(resolveExit => {
    const child = spawn(executable, args, options);
    const signals = new Map(["SIGINT", "SIGTERM"].map(signal => [signal, () => child.kill(signal)]));
    for (const [signal, forward] of signals) process.on(signal, forward);
    function finish(code) {
      for (const [signal, forward] of signals) process.removeListener(signal, forward);
      resolveExit(code);
    }
    child.once("error", () => {
      console.error("Unable to launch the production command.");
      finish(1);
    });
    child.once("exit", (code, signal) => finish(code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1)));
  });
}

export async function runProduction(command, { execute = executeStep, env = process.env } = {}) {
  if (!["build", "start"].includes(command)) throw new Error("Expected build or start");
  const steps = command === "build"
    ? [[prisma, "generate", "--config", "prisma7.config.ts"], [next, "build"]]
    : [[next, "start", "--hostname", "0.0.0.0"]];
  // Set this before either CLI loads dotenv or React; setting it in next.config is too late.
  const options = { cwd: root, stdio: "inherit", env: { ...env, NODE_ENV: "production" } };
  for (const args of steps) {
    const code = await execute(process.execPath, args, options);
    if (code !== 0) return code;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await runProduction(process.argv[2]); }
  catch { console.error("Production launcher failed. Expected build or start."); process.exitCode = 1; }
}
