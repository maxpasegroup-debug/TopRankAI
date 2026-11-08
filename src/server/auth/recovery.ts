import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import { ApiError, ValidationApiError } from "@/server/api/errors";
import { hashPassword } from "./password";
import { createSessionToken, hashSessionToken } from "./session";

export const RECOVERY_MESSAGE = "If an eligible account exists, recovery instructions will be sent.";
export const RESET_DURATION_MS = 30 * 60 * 1000;
export const RECOVERABLE_ROLES = ["STUDENT", "PARENT"] as const;
type DeliveryConfig = { key: Buffer; apiKey: string; from: string; appUrl: string };
export function readRecoveryConfig(): DeliveryConfig {
  const unavailable = () => new ApiError(503, "RECOVERY_UNAVAILABLE", "Account recovery is temporarily unavailable");
  try {
    if (process.env.AUTH_RECOVERY_DELIVERY_VERIFIED !== "true" || process.env.AUTH_EMAIL_PROVIDER !== "resend") throw unavailable();
    const encoded = process.env.AUTH_RECOVERY_ENCRYPTION_KEY ?? "";
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded || !process.env.RESEND_API_KEY || !z.email().safeParse(process.env.AUTH_EMAIL_FROM).success) throw unavailable();
    const url = new URL(process.env.APP_URL ?? "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw unavailable();
    return { key, apiKey: process.env.RESEND_API_KEY!, from: process.env.AUTH_EMAIL_FROM!, appUrl: url.origin };
  } catch { throw unavailable(); }
}
export function encryptRecoveryPayload(value: { email: string; token: string }, id: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}
export function decryptRecoveryPayload(value: string, id: string, key: Buffer) {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) throw new Error();
    const [iv, tag, data] = parts.map(part => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(id)); decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return z.object({ email: z.email(), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().parse(JSON.parse(plain));
  } catch { throw new ApiError(503, "RECOVERY_UNAVAILABLE", "Account recovery is temporarily unavailable"); }
}

export async function queuePasswordRecovery(email: string, config = readRecoveryConfig()) {
  const user = await prisma.user.findFirst({ where: { email, role: { in: [...RECOVERABLE_ROLES] }, status: "ACTIVE", pinHash: null }, select: { id: true, email: true } });
  if (user) {
    const token = createSessionToken(); const id = randomUUID();
    for (let attempt = 0; attempt < 3; attempt++) {
    try { await prisma.$transaction(async tx => {
      await tx.passwordReset.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date(), deliveryPayload: null } });
      await tx.passwordReset.create({ data: { id, userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + RESET_DURATION_MS),
        deliveryPayload: encryptRecoveryPayload({ email: user.email, token }, id, config.key) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); break; }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2034", "P2002"].includes(error.code) || attempt === 2) throw new ApiError(503, "RECOVERY_UNAVAILABLE", "Account recovery is temporarily unavailable");
    }
    }
  }
  // Delivery is a separate bounded worker, never part of the public response.
  return { message: RECOVERY_MESSAGE };
}

export async function deliverPasswordRecoveries(limit = 5, config = readRecoveryConfig(), transport: typeof fetch = fetch) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ValidationApiError();
  const pending = { consumedAt: null, expiresAt: { gt: new Date() }, deliveryAttempts: { lt: 3 }, deliveryPayload: { not: null },
    deliveryState: { in: ["PENDING", "FAILED"] }, OR: [{ deliveryLeaseUntil: null }, { deliveryLeaseUntil: { lt: new Date() } }] };
  const rows = await prisma.passwordReset.findMany({ where: pending, take: limit, orderBy: { createdAt: "asc" } });
  let accepted = 0;
  for (const row of rows) {
    const claim = await prisma.passwordReset.updateMany({ where: { ...pending, id: row.id }, data: { deliveryLeaseUntil: new Date(Date.now() + 60_000), deliveryAttempts: { increment: 1 } } });
    if (claim.count !== 1) continue;
    try {
      const payload = decryptRecoveryPayload(row.deliveryPayload!, row.id, config.key);
      if (hashSessionToken(payload.token) !== row.tokenHash || row.expiresAt.getTime() <= Date.now()) throw new Error();
      const response = await transport("https://api.resend.com/emails", { method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
        headers: { authorization: "Bearer " + config.apiKey, "content-type": "application/json", "Idempotency-Key": "toprank-recovery-" + row.id },
        body: JSON.stringify({ from: config.from, to: [payload.email], subject: "Reset your TopRank AI password",
          text: "Use this link within 30 minutes to reset your password: " + config.appUrl + "/reset-password#token=" + payload.token + "\nIf you did not request this, you can ignore this email." }) });
      await response.body?.cancel();
      if (!response.ok) throw new Error();
      await prisma.passwordReset.updateMany({ where: { id: row.id, consumedAt: null }, data: { deliveryState: "SENT", deliveryPayload: null, deliveryLeaseUntil: null } });
      accepted++;
    } catch {
      await prisma.passwordReset.updateMany({ where: { id: row.id, consumedAt: null }, data: { deliveryState: "FAILED", deliveryLeaseUntil: null } });
    }
  }
  return { processed: rows.length, accepted };
}

export async function resetPassword(token: string, password: string) {
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async tx => {
    const where = { tokenHash: hashSessionToken(token), consumedAt: null, expiresAt: { gt: new Date() }, deliveryState: "SENT", user: { status: "ACTIVE" as const, role: { in: [...RECOVERABLE_ROLES] }, pinHash: null } };
    const reset = await tx.passwordReset.findFirst({ where });
    if (!reset || (await tx.passwordReset.updateMany({ where: { ...where, id: reset.id }, data: { consumedAt: new Date(), deliveryPayload: null } })).count !== 1) {
      throw new ValidationApiError("Recovery link is invalid or expired");
    }
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await tx.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.passwordReset.updateMany({ where: { userId: reset.userId, consumedAt: null }, data: { consumedAt: new Date(), deliveryPayload: null } });
    await tx.auditEvent.create({ data: { actorId: reset.userId, action: "PASSWORD_RECOVERED", entity: "User", entityId: reset.userId } });
    return { reset: true };
  });
}

export async function clearExpiredRecoveryPayloads(limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ValidationApiError();
  const where = { deliveryPayload: { not: null }, OR: [{ expiresAt: { lte: new Date() } }, { consumedAt: { not: null } }] };
  const rows = await prisma.passwordReset.findMany({ where, select: { id: true }, take: limit, orderBy: [{ expiresAt: "asc" }, { id: "asc" }] });
  if (!rows.length) return { cleared: 0 };
  const result = await prisma.passwordReset.updateMany({ where: { ...where, id: { in: rows.map(row => row.id) } }, data: { deliveryPayload: null, deliveryLeaseUntil: null } });
  return { cleared: result.count };
}
