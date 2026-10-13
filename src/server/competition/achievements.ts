import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { prisma } from "@/server/db";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { studyStreak, verifiedScore } from "./rules";
import { achievementSchema, configSchema } from "./validation";
import type { z } from "zod";
import { inAppNotice } from "@/server/notifications/service";
export type Tx = Prisma.TransactionClient;
export async function atomic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
 for (let i = 0; i < 3; i++) { try { return await prisma.$transaction(fn, { isolationLevel: "Serializable" }); }
   catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(e.code)) throw e; } }
 throw new ConflictApiError("Concurrent update. Reload and retry.");
}
export async function audit(tx: Tx, actorId: string, entity: string, entityId: string, action: string, detail?: string) {
 await tx.auditEvent.create({ data: { actorId, entity, entityId, action, detail: detail?.slice(0, 500) } });
}
export async function qualification(tx: Pick<Tx, "competitionEntry" | "studentLessonProgress" | "studySession" | "mockAttempt">, userId: string, definition: { id?: string; kind: string; threshold: number }, scope = "GLOBAL") {
 if (definition.kind === "PLACEMENT") {
   const entry = await tx.competitionEntry.findFirst({ where: { userId, competitionId: scope, disqualified: false,
     rank: { lte: definition.threshold }, competition: { status: "COMPLETED", resultsVerifiedAt: { not: null } } }, select: { rank: true, id: true, competition: { select: { config: true, title: true } } } });
   const rule = entry ? configSchema.parse(entry.competition.config).awards.find((a) => a.definitionId === definition.id) : null;
   return entry?.rank && rule && entry.rank >= rule.fromRank && entry.rank <= rule.toRank ? { explanation: `Placed ${entry.rank} in ${entry.competition.title} under the saved ranking rules.`, evidence: { entryId: entry.id, rank: entry.rank, competitionId: scope } } : null;
 }
 if (scope !== "GLOBAL") return null;
 if (definition.kind === "LESSONS") {
   const count = await tx.studentLessonProgress.count({ where: { userId, completedAt: { not: null },
     lesson: { status: "PUBLISHED", active: true, chapter: { status: "PUBLISHED", active: true, subject: { status: "PUBLISHED", active: true } } } } });
   return count >= definition.threshold ? { explanation: `${definition.threshold} published lessons marked complete (self-reported).`, evidence: { completedLessons: count } } : null;
 }
 if (definition.kind === "STUDY_DAYS") {
   const sessions = await tx.studySession.findMany({ where: { userId, endedAt: { not: null }, startedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
     orderBy: { startedAt: "desc" }, take: 1000, select: { startedAt: true, endedAt: true } });
   const streak = studyStreak(sessions);
   return streak >= definition.threshold ? { explanation: `${definition.threshold} consecutive UTC days with at least 15 recorded study minutes in the latest 30 days.`, evidence: { streak } } : null;
 }
 const attempts = await tx.mockAttempt.findMany({ where: { userId, status: { not: "IN_PROGRESS" } }, orderBy: { startedAt: "asc" }, take: 1000,
   select: { id: true, mockExamId: true, result: true, startedAt: true, snapshot: true } });
 const nonblank = attempts.filter((a) => a.result && Number((a.result as { answered?: number }).answered) > 0);
 if (definition.kind === "FIRST_MOCK") return nonblank.length ? { explanation: "Completed a saved mock attempt with at least one answer.", evidence: { attemptId: nonblank[0].id } } : null;
 if (definition.kind === "IMPROVEMENT") {
   const earliest = new Map<string, typeof nonblank[number]>();
   for (const a of nonblank) { const key = `${a.mockExamId}:${createHash("sha256").update(JSON.stringify(a.snapshot)).digest("hex")}`;
     const previous = earliest.get(key); if (!previous) { earliest.set(key, a); continue; }
     if (a.startedAt <= previous.startedAt) continue;
     const old = verifiedScore(previous.result, "PERCENT_SCORE"), current = verifiedScore(a.result, "PERCENT_SCORE");
     if (current.score.minus(old.score).gte(definition.threshold)) return { explanation: `Improved by at least ${definition.threshold} percentage points between saved attempts of the same mock.`, evidence: { fromAttemptId: previous.id, toAttemptId: a.id } };
   }
 }
 return null;
}
export async function earn(tx: Tx, userId: string, definition: { id: string; title: string; badge: string }, scope: string,
 proof: { explanation: string; evidence: object }, actorId: string) {
 const existing = await tx.earnedAchievement.findUnique({ where: { userId_definitionId_scope: { userId, definitionId: definition.id, scope } } });
 if (existing) return existing; // Explicit admin revocations are never undone by an eligibility recheck.
 const earned = await tx.earnedAchievement.create({ data: { userId, definitionId: definition.id, scope, title: definition.title,
   badge: definition.badge, explanation: proof.explanation, evidence: proof.evidence as Prisma.InputJsonValue } });
 await audit(tx, actorId, "ACHIEVEMENT", earned.id, "ACHIEVEMENT_EARNED");
 await inAppNotice(tx, userId, `achievement:${earned.id}:earned`, "ACHIEVEMENT_EARNED"); return earned;
}
export async function checkAchievements(user: AuthUser) {
 assertStudent(user);
 return atomic(async (tx) => {
   const definitions = await tx.achievementDefinition.findMany({ where: { status: "PUBLISHED", kind: { not: "PLACEMENT" } }, take: 100 });
   let qualified = 0;
   for (const definition of definitions) { const proof = await qualification(tx, user.id, definition); if (proof) { await earn(tx, user.id, definition, "GLOBAL", proof, user.id); qualified++; } }
   return { qualified };
 });
}
export async function getAchievements(user: AuthUser) {
 assertStudent(user);
 const records = await prisma.earnedAchievement.findMany({ where: { userId: user.id }, take: 100, orderBy: { awardedAt: "desc" }, include: { prize: true } });
 const events = records.length ? await prisma.auditEvent.findMany({ where: { entity: "ACHIEVEMENT", entityId: { in: records.map((a) => a.id) } },
   orderBy: { createdAt: "desc" }, take: 300, select: { entityId: true, action: true, createdAt: true } }) : [];
 return records.map((a) => ({ id: a.id, title: a.title, badge: a.badge, explanation: a.explanation, status: a.status,
   awardedAt: a.awardedAt.toISOString(), sharing: Boolean(a.shareHash),
   history: events.filter((e) => e.entityId === a.id).map((e) => ({ action: e.action, at: e.createdAt.toISOString() })),
   prize: a.prize ? { label: a.prize.label, status: a.prize.status } : null }));
}
export async function mutateAchievement(user: AuthUser, raw: z.infer<typeof achievementSchema>) {
 assertStudent(user); const input = achievementSchema.parse(raw);
 if (input.action === "check") return checkAchievements(user);
 return atomic(async (tx) => {
   const earned = await tx.earnedAchievement.findFirst({ where: { id: input.id, userId: user.id, status: "ACTIVE", definition: { status: "PUBLISHED" } }, include: { definition: true } });
   if (!earned) throw new ValidationApiError("Achievement is unavailable");
   if (input.enabled && earned.definition?.kind === "PLACEMENT" && !await qualification(tx, user.id, earned.definition, earned.scope)) throw new ValidationApiError("Verified results are required before sharing this achievement");
   const token = input.enabled ? randomBytes(32).toString("base64url") : null;
   await tx.earnedAchievement.update({ where: { id: earned.id }, data: { shareHash: token ? hashShare(token) : null, version: { increment: 1 } } });
   return { href: token ? `/shared/achievements/${token}` : null };
 });
}
export function hashShare(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function getSharedAchievement(token: string) {
 if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
 const a = await prisma.earnedAchievement.findFirst({ where: { shareHash: hashShare(token), status: "ACTIVE", definition: { status: "PUBLISHED" },
   user: { status: "ACTIVE", role: "STUDENT" } }, select: { title: true, badge: true, explanation: true, awardedAt: true, userId: true, scope: true, definition: { select: { id: true, kind: true, threshold: true } } } });
 if (a?.definition?.kind === "PLACEMENT" && !await qualification(prisma, a.userId, a.definition, a.scope)) return null;
 return a ? { title: a.title, badge: a.badge, explanation: a.explanation, awardedAt: a.awardedAt.toISOString() } : null;
}
