import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseUrl } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: pg.Pool;
};

/**
 * Neon closes idle connections, and a pooled socket that dies between checkout
 * and query surfaces as Prisma P1017 "Server has closed the connection". The
 * pool therefore recycles connections well before the server's idle cutoff and
 * keeps a small cap so a single dev process does not exhaust the database.
 */
export function createPrismaPool() {
  return new pg.Pool({
    connectionString: databaseUrl(),
    max: 5,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
    maxLifetimeSeconds: 300,
  });
}

export function createPrismaClient() {
  const pool = globalForPrisma.pool ?? createPrismaPool();
  if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
