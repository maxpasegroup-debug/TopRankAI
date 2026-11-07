import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const launcher = new URL("../../scripts/production.mjs", import.meta.url).href;
const { runProduction } = await import(launcher);
const root = fileURLToPath(new URL("../../", import.meta.url));
const next = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
const prisma = fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url));

describe("production command environment (mocked child processes)", () => {
  it.each([undefined, "development", "test", "staging", "production"])("build overrides inherited NODE_ENV=%s before generation and Next", async value => {
    const env = { NODE_ENV: value, DATABASE_URL: "test-only-placeholder", PORT: "4317", AUTH_RATE_LIMIT_ACTIVATED: "false", ACCOUNT_POLICY_REVIEWED: "false" };
    const execute = vi.fn().mockResolvedValue(0);
    expect(await runProduction("build", { env, execute })).toBe(0);
    expect(execute).toHaveBeenNthCalledWith(1, process.execPath, [prisma, "generate", "--config", "prisma7.config.ts"], { cwd: root, stdio: "inherit", env: { ...env, NODE_ENV: "production" } });
    expect(execute).toHaveBeenNthCalledWith(2, process.execPath, [next, "build"], { cwd: root, stdio: "inherit", env: { ...env, NODE_ENV: "production" } });
    expect(env.NODE_ENV).toBe(value);
  });
  it("start forces production too and preserves the Railway port and security flags", async () => {
    const execute = vi.fn().mockResolvedValue(0);
    const env = { NODE_ENV: "development", PORT: "8080", AUTH_TRUSTED_PROXY_VERIFIED: "false", ACCOUNT_GUARDIAN_VERIFICATION_APPROVED: "false", AUTH_RECOVERY_DELIVERY_VERIFIED: "false" };
    expect(await runProduction("start", { execute, env })).toBe(0);
    expect(execute).toHaveBeenCalledExactlyOnceWith(process.execPath, [next, "start", "--hostname", "0.0.0.0"], { cwd: root, stdio: "inherit", env: { ...env, NODE_ENV: "production" } });
    expect(execute.mock.calls[0][2].env).not.toHaveProperty("AUTH_RATE_LIMIT_ACTIVATED");
    expect(execute.mock.calls[0][2].env).not.toHaveProperty("ACCOUNT_PRIVACY_PROCESSING_APPROVED");
  });
  it.each([1, 7, 143])("does not run Next after Prisma exits %s", async code => {
    const execute = vi.fn().mockResolvedValue(code);
    expect(await runProduction("build", { execute, env: {} })).toBe(code); expect(execute).toHaveBeenCalledOnce();
  });
  it("propagates a Next build failure", async () => {
    const execute = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(9);
    expect(await runProduction("build", { execute, env: {} })).toBe(9); expect(execute).toHaveBeenCalledTimes(2);
  });
  it("rejects unknown commands before starting a process", async () => {
    const execute = vi.fn(); await expect(runProduction("deploy", { execute })).rejects.toThrow("Expected build or start"); expect(execute).not.toHaveBeenCalled();
  });
  it("never adds migration, installation, deployment or activation steps", async () => {
    const execute = vi.fn().mockResolvedValue(0);
    await runProduction("build", { execute, env: {} });
    expect(execute.mock.calls.map(call => call[1].slice(1))).toEqual([["generate", "--config", "prisma7.config.ts"], ["build"]]);
    expect(execute.mock.calls.every(call => Object.keys(call[2].env).join() === "NODE_ENV")).toBe(true);
  });
  it("wires both production package scripts while leaving local dev alone", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(pkg.scripts.build).toBe("node scripts/production.mjs build"); expect(pkg.scripts.start).toBe("node scripts/production.mjs start");
    expect(pkg.scripts.dev).toBe("next dev --hostname 0.0.0.0");
  });
});
