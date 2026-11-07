import { defineConfig } from "prisma/config";
import path from "node:path";

// This config never loads dotenv or the application's ordinary datasource.
if (process.env.TOPRANK_VERIFICATION_CHILD !== "true" || !process.env.DATABASE_URL || process.env.NODE_ENV !== "test") {
  throw new Error("Use the guarded verification command, not this config directly.");
}
export default defineConfig({
  schema: path.resolve("prisma/schema.prisma"),
  migrations: { path: path.resolve("prisma/migrations") },
  datasource: { url: process.env.DATABASE_URL },
});
