import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const confirmation = process.env.TOPRANK_TEST_ADMIN_BOOTSTRAP;
if (!connectionString) throw new Error("DATABASE_URL is required.");
if (confirmation !== "CREATE_ONE_TEST_ADMIN") throw new Error("Set TOPRANK_TEST_ADMIN_BOOTSTRAP=CREATE_ONE_TEST_ADMIN to confirm a one-time test admin bootstrap.");
const db = new URL(connectionString);
const database = db.pathname.replace(/^\//, "");
if (!db.hostname.endsWith("neon.tech") || database !== "neondb" || process.env.NODE_ENV === "production") {
  throw new Error("Admin bootstrap is restricted to the designated Neon neondb testing database in non-production mode.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const email = "admin.testing@toprank.local";
try {
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { role: "PLATFORM_ADMIN" }] }, select: { id: true, email: true } });
  if (existing) throw new Error("An admin or the bootstrap email already exists. No password was changed.");
  const password = randomBytes(27).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({ data: { name: "TopRank Test Admin", email, passwordHash, emailVerifiedAt: new Date(), role: "PLATFORM_ADMIN" }, select: { id: true } });
  console.log(JSON.stringify({ created: true, id: admin.id, email, temporaryPassword: password, loginUrl: "http://localhost:3000/login", adminUrl: "http://localhost:3000/admin", note: "Store this password securely and replace it after the first sign-in." }, null, 2));
} finally {
  await prisma.$disconnect();
}
