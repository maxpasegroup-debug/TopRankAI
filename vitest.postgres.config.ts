import { defineConfig } from "vitest/config";

export default defineConfig({ test: {
  environment: "node", include: ["tests/postgres-live/**/*.pg.test.ts"],
  setupFiles: ["tests/postgres-live/read-only.setup.ts"], fileParallelism: false,
  env: { TOPRANK_POSTGRES_READ_SUITE: "true" },
} });
