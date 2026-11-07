import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { assertPlatformAdmin } from "@/server/operations/service";
import { prisma } from "@/server/db";
import { ValidationApiError, ConflictApiError } from "@/server/api/errors";
import { mutateMock, reconcileCompetitionAttempt, mutateAdminMock, requireMockReview } from "@/server/mock/service";
import { inAppNotice } from "@/server/notifications/service";
import { atomic, audit, earn, qualification, type Tx } from "./achievements";
import { phase, requireWindow, rankEntries, verifiedScore } from "./rules";
import { configSchema, competitionSchema, adminCompetitionSchema, participationSchema, pageSchema } from "./validation";
import { idSchema } from "@/server/mock/validation";
import type { z } from "zod";
import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
import { requireSharingConsent, sharingStudentWhere } from "@/server/auth/sharing";
type Competition = Prisma.CompetitionGetPayload<{ include: { mockExam: true } }>;
const includeMock = { mockExam: true };
const missing = () => new ValidationApiError("Competition or record is unavailable");
async function getCompetition(tx: Tx, id: string) { const c = await tx.competition.findUnique({ where: { id }, include: includeMock }); if (!c) throw missing(); return c; }
async function bump(tx: Tx, c: Competition, data: Prisma.CompetitionUpdateManyMutationInput = {}) {
 const changed = await tx.competition.updateMany({ where: { id: c.id, version: c.version }, data: { ...data, version: { increment: 1 } } });
 if (changed.count !== 1) throw new ConflictApiError("Competition changed. Reload first.");
}
function dto(c: Competition) { return { id: c.id, title: c.title, type: c.type, phase: phase(c.status, c.startsAt, c.endsAt, new Date()),
 rankingState: c.status === "CANCELLED" ? "CANCELLED" : c.status === "COMPLETED" && c.resultsVerifiedAt ? "VERIFIED" : "PROVISIONAL", resultsVerifiedAt: c.resultsVerifiedAt?.toISOString() ?? null,
 startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(), finishBy: new Date(c.endsAt.getTime() + c.mockExam.durationSeconds * 1000).toISOString(),
 durationSeconds: c.mockExam.durationSeconds, config: configSchema.parse(c.config) }; }
async function validateCompetition(tx: Tx, c: Competition) {
 const config = configSchema.parse(c.config), mock = c.mockExam;
 if (mock.status !== "PUBLISHED" || mock.version !== c.mockVersion || mock.maxAttempts !== 1 || mock.revealPolicy !== "NEVER") throw new ValidationApiError("Use an unchanged published, single-attempt mock with withheld explanations");
 await requireMockReview(tx, mock);
 if (await tx.mockAttempt.count({ where: { mockExamId: mock.id } })) throw new ValidationApiError("Use a dedicated mock with no previous attempts");
 for (const award of config.awards) { const def = await tx.achievementDefinition.findFirst({ where: { id: award.definitionId, status: "PUBLISHED", kind: "PLACEMENT" } });
   if (!def || award.toRank > def.threshold || award.toRank > config.capacity) throw new ValidationApiError("Publish compatible placement definitions and rank ranges first"); }
}
async function settle(tx: Tx, c: Competition, actorId: string, close = false) {
 const config = configSchema.parse(c.config);
 if (!["PUBLISHED", "COMPLETED"].includes(c.status)) throw missing();
 const entries = await tx.competitionEntry.findMany({ where: { competitionId: c.id }, take: 1001 });
 if (entries.length > config.capacity) throw new ConflictApiError("Competition capacity requires review");
 let pending = 0;
 for (const e of entries) {
   if (e.disqualified) { e.score = null; e.timeSeconds = null; continue; }
   if (!e.attemptId) { if (new Date() < c.endsAt) pending++; e.score = null; e.timeSeconds = null; continue; }
   const a = await reconcileCompetitionAttempt(tx, e.attemptId);
   if (a.userId !== e.userId || a.mockExamId !== c.mockExamId || a.startedAt < c.startsAt || a.startedAt >= c.endsAt || a.startedAt < e.joinedAt) throw new ValidationApiError("Entry source requires administrator review");
   if (a.status === "IN_PROGRESS") { pending++; e.score = null; e.timeSeconds = null; continue; }
   if (!a.finalizedAt || a.finalizedAt > new Date(c.endsAt.getTime() + c.mockExam.durationSeconds * 1000)) throw new ValidationApiError("Result falls outside the permitted finish window");
   const verified = verifiedScore(a.result, config.scoring); e.score = verified.score; e.timeSeconds = verified.timeSeconds;
 }
 if ((close || c.status === "COMPLETED") && (new Date() < c.endsAt || pending)) throw new ValidationApiError("Close only after entry window ends and started attempts finish or expire");
 const ranked = rankEntries(entries);
 for (const e of entries) await tx.competitionEntry.update({ where: { id: e.id }, data: { score: e.score, timeSeconds: e.timeSeconds, rank: ranked.find((r) => r.id === e.id)?.rank ?? null } });
 const verified = close || c.status === "COMPLETED";
 await bump(tx, c, { ...(close ? { status: "COMPLETED" } : {}), resultsVerifiedAt: verified ? new Date() : null });
 if (verified) for (const entry of entries) await inAppNotice(tx, entry.userId, `competition:${c.id}:verified:${c.version + 1}`, "COMPETITION_VERIFIED");
 if (close || c.status === "COMPLETED") {
   const activeAwards = new Set<string>();
   for (const rule of config.awards) {
     const definition = await tx.achievementDefinition.findFirst({ where: { id: rule.definitionId, status: "PUBLISHED", kind: "PLACEMENT" } });
     if (!definition) continue;
     for (const entry of ranked.filter((e) => e.rank >= rule.fromRank && e.rank <= rule.toRank)) {
       const proof = { explanation: `Placed ${entry.rank} in ${c.title} under the saved ranking rules.`, evidence: { entryId: entry.id, rank: entry.rank, competitionId: c.id } };
       const achievement = await earn(tx, entry.userId, definition, c.id,
         proof, actorId);
       activeAwards.add(achievement.id);
       const oldEvidence = achievement.evidence as { entryId?: string; rank?: number; competitionId?: string };
       if (achievement.status === "ACTIVE" && (oldEvidence.entryId !== entry.id || oldEvidence.rank !== entry.rank || oldEvidence.competitionId !== c.id)) {
         await tx.earnedAchievement.update({ where: { id: achievement.id }, data: { explanation: proof.explanation, evidence: proof.evidence, shareHash: null, version: { increment: 1 } } });
         await audit(tx, actorId, "ACHIEVEMENT", achievement.id, "ACHIEVEMENT_PLACEMENT_CORRECTED", `Recalculated rank ${entry.rank}`);
       }
       if (achievement.status === "REVOKED" && achievement.revocationSource === "AUTO") {
         await tx.earnedAchievement.update({ where: { id: achievement.id }, data: { status: "ACTIVE", revocationSource: null, explanation: proof.explanation, evidence: proof.evidence, version: { increment: 1 } } });
         await audit(tx, actorId, "ACHIEVEMENT", achievement.id, "ACHIEVEMENT_RESTORED", "Recalculated placement eligibility");
       }
       if (rule.prizeLabel && achievement.revocationSource !== "ADMIN") await tx.prizeAward.upsert({ where: { achievementId: achievement.id },
         create: { achievementId: achievement.id, label: rule.prizeLabel }, update: {} });
     }
   }
   const awards = await tx.earnedAchievement.findMany({ where: { scope: c.id, status: "ACTIVE" }, select: { id: true } });
   for (const award of awards.filter((a) => !activeAwards.has(a.id))) await revoke(tx, actorId, award.id, "AUTO", "Placement no longer eligible after recalculation");
 }
 return { ranked: ranked.length, pending };
}
async function revoke(tx: Tx, actorId: string, id: string, source: string, reason: string) {
 await tx.earnedAchievement.update({ where: { id }, data: { status: "REVOKED", revocationSource: source, shareHash: null, version: { increment: 1 } } });
 await tx.prizeAward.updateMany({ where: { achievementId: id, status: { not: "FULFILLED" } }, data: { status: "REJECTED", decision: reason, version: { increment: 1 } } });
 await audit(tx, actorId, "ACHIEVEMENT", id, "ACHIEVEMENT_REVOKED", reason);
}
export async function competitionDirectory(user: AuthUser) {
 assertStudent(user); const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true } });
 const records = profile?.targetExamId ? await prisma.competition.findMany({ where: { status: { not: "DRAFT" }, mockExam: { examId: profile.targetExamId } }, orderBy: { startsAt: "desc" }, take: 100, include: includeMock }) : [];
 const entries = await prisma.competitionEntry.findMany({ where: { userId: user.id }, take: 100, orderBy: { joinedAt: "desc" },
   select: { competitionId: true, attemptId: true, disqualified: true, rank: true, score: true, visible: true } });
 return { competitions: records.map(dto), entries: entries.map((e) => ({ ...e, score: e.score?.toString() ?? null })) };
}
export async function competitionLeaderboard(user: AuthUser, id: string, rawPage: unknown = 1) {
 assertStudent(user); idSchema.parse(id); const page = pageSchema.parse(rawPage);
 return atomic(async (tx) => { const c = await getCompetition(tx, id); if (c.status === "DRAFT") throw missing();
   const rows = c.status === "CANCELLED" ? [] : await tx.competitionEntry.findMany({ where: { competitionId: id, rank: { not: null }, disqualified: false, user: sharingStudentWhere() },
     orderBy: [{ rank: "asc" }, { alias: "asc" }], skip: (page - 1) * 25, take: 26, select: { alias: true, visible: true, rank: true, score: true, timeSeconds: true } });
   const mine = await tx.competitionEntry.findUnique({ where: { competitionId_userId: { competitionId: id, userId: user.id } },
     select: { attemptId: true, rank: true, score: true, disqualified: true, visible: true } });
   return { competition: dto(c), page, hasNext: rows.length > 25, rows: rows.slice(0, 25).map((e) => ({ rank: e.rank,
     name: e.visible ? `Participant ${e.alias}` : "Private participant", score: e.visible ? e.score?.toString() : null, timeSeconds: e.visible ? e.timeSeconds : null })),
     mine: mine ? { ...mine, rank: c.status === "CANCELLED" ? null : mine.rank, score: c.status === "CANCELLED" ? null : mine.score?.toString() ?? null } : null };
 });
}
export async function participate(user: AuthUser, raw: z.infer<typeof participationSchema>) {
 assertStudent(user); const input = participationSchema.parse(raw);
 if (input.action !== "join") return atomic(async (tx) => {
   const e = await tx.competitionEntry.findUnique({ where: { competitionId_userId: { competitionId: input.id, userId: user.id } } }); if (!e) throw missing();
   if (input.action === "visibility") { if (input.visible) await requireSharingConsent(tx, user.id); await tx.competitionEntry.update({ where: { id: e.id }, data: { visible: input.visible } }); return { saved: true }; }
   const c = await getCompetition(tx, input.id);
   if (c.status === "COMPLETED") return { ranked: await tx.competitionEntry.count({ where: { competitionId: c.id, rank: { not: null }, disqualified: false } }), pending: 0 };
   return settle(tx, c, user.id);
 });
 const entry = await atomic(async (tx) => {
   const replay = await tx.competitionEntry.findUnique({ where: { userId_requestKey: { userId: user.id, requestKey: input.requestKey } } });
   if (replay && replay.competitionId !== input.id) throw new ConflictApiError("Request key already used");
   const previous = replay ?? await tx.competitionEntry.findUnique({ where: { competitionId_userId: { competitionId: input.id, userId: user.id } } });
   const c = await getCompetition(tx, input.id);
   if (previous?.disqualified) throw new ValidationApiError("This entry is disqualified");
   if (previous?.attemptId && c.status !== "CANCELLED" && !previous.disqualified) return previous;
   requireWindow(c.status, c.startsAt, c.endsAt, new Date());
   const profile = await tx.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true, onboardingCompletedAt: true } });
   if (!profile?.onboardingCompletedAt || profile.targetExamId !== c.mockExam.examId || c.mockExam.version !== c.mockVersion) throw new ValidationApiError("Complete onboarding for the eligible exam");
   const config = configSchema.parse(c.config);
   if (await tx.mockAttempt.count({ where: { userId: user.id, status: { not: "IN_PROGRESS" } } }) < config.minCompletedMocks) throw new ValidationApiError("Complete the required saved mock attempts first");
   if (previous) return previous;
   if (await tx.competitionEntry.count({ where: { competitionId: c.id } }) >= config.capacity) throw new ValidationApiError("Competition participation limit reached");
   return tx.competitionEntry.create({ data: { competitionId: c.id, userId: user.id, requestKey: input.requestKey, alias: randomBytes(6).toString("hex"), joinedAt: new Date() } });
 });
 if (entry.attemptId) return { attemptId: entry.attemptId };
 const c = await prisma.competition.findUnique({ where: { id: input.id } }); if (!c) throw missing();
 const attempt = await mutateMock(user, { action: "start", mockId: c.mockExamId, requestKey: entry.requestKey }, c.id);
 return atomic(async (tx) => {
   const current = await getCompetition(tx, c.id);
   const a = await tx.mockAttempt.findFirst({ where: { id: attempt.id, userId: user.id, mockExamId: c.mockExamId }, select: { startedAt: true } });
   const e = await tx.competitionEntry.findUnique({ where: { id: entry.id } });
   if (!e || e.disqualified || current.status === "CANCELLED" || !a || a.startedAt < current.startsAt || a.startedAt >= current.endsAt || a.startedAt < entry.joinedAt) throw missing();
   await tx.competitionEntry.update({ where: { id: entry.id }, data: { attemptId: attempt.id } }); return { attemptId: attempt.id };
 });
}
export async function getCompetitionSuggestion(user: AuthUser) {
 assertStudent(user); const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { targetExamId: true } });
 if (!profile?.targetExamId) return null;
 const c = await prisma.competition.findFirst({ where: { status: "PUBLISHED", startsAt: { lte: new Date() }, endsAt: { gt: new Date() }, mockExam: { examId: profile.targetExamId }, entries: { none: { userId: user.id } } }, orderBy: { endsAt: "asc" }, select: { id: true, title: true } });
 return c ? { suggestion: `A published challenge is open: ${c.title}. Review eligibility before joining.`, href: `/compete?id=${encodeURIComponent(c.id)}` } : null;
}
export async function overallLeaderboard(user: AuthUser, rawPage: unknown = 1) {
 assertStudent(user); const page = pageSchema.parse(rawPage), offset = (page - 1) * 25;
 // Only opted-in completed placements contribute. Account identifiers stay inside SQL.
 const rows = await prisma.$queryRaw<{ alias: string; points: bigint; rank: bigint }[]>(Prisma.sql`
   WITH totals AS (SELECT e."userId", MIN(e."alias") AS alias, SUM(1001 - e."rank")::bigint AS points,
     SUM(e."timeSeconds") AS seconds, MIN(e."joinedAt") AS joined
   FROM "CompetitionEntry" e JOIN "Competition" c ON c.id = e."competitionId"
   JOIN "User" u ON u.id = e."userId"
   WHERE c.status = 'COMPLETED' AND e.visible = true AND e.disqualified = false
     AND c."resultsVerifiedAt" IS NOT NULL
     AND e.rank IS NOT NULL AND u.status = 'ACTIVE' AND u.role = 'STUDENT'
     AND EXISTS (SELECT 1 FROM "AccountConsent" ac WHERE ac."userId" = u.id AND ac."revokedAt" IS NULL
       AND ac."termsVersion" = ${ACCOUNT_POLICY_VERSION} AND ac."privacyVersion" = ${ACCOUNT_POLICY_VERSION}
       AND (ac."ageBand" = '18_PLUS' OR (ac."ageBand" IN ('UNDER_13','13_TO_17') AND EXISTS (
         SELECT 1 FROM "GuardianRegistrationGrant" g JOIN "User" guardian ON guardian.id = g."guardianId"
         WHERE g.id = ac."guardianGrantId" AND g."revokedAt" IS NULL AND g."usedAt" IS NOT NULL
           AND g."policyVersion" = ${ACCOUNT_POLICY_VERSION} AND guardian.status = 'ACTIVE' AND guardian.role = 'PARENT'
           AND EXISTS (SELECT 1 FROM "AccountConsent" gc WHERE gc."userId" = guardian.id AND gc."revokedAt" IS NULL
             AND gc."ageBand" = '18_PLUS' AND gc."termsVersion" = ${ACCOUNT_POLICY_VERSION} AND gc."privacyVersion" = ${ACCOUNT_POLICY_VERSION})))))
   GROUP BY e."userId")
   SELECT alias, points, RANK() OVER (ORDER BY points DESC, seconds ASC, joined ASC) AS rank
   FROM totals ORDER BY points DESC, seconds ASC, joined ASC, "userId" COLLATE "C" ASC
   LIMIT 26 OFFSET ${offset}`);
 return { page, hasNext: rows.length > 25, rows: rows.slice(0, 25).map((r) => ({ rank: Number(r.rank), name: `Participant ${r.alias}`, points: r.points.toString() })) };
}
export async function adminCompetitionData(user: AuthUser) {
 assertPlatformAdmin(user);
 return { competitions: await prisma.competition.findMany({ take: 100, orderBy: { startsAt: "desc" }, include: includeMock }),
   mocks: await prisma.mockExam.findMany({ where: { status: "PUBLISHED", maxAttempts: 1, revealPolicy: "NEVER", competition: null, attempts: { none: {} } }, take: 100, select: { id: true, title: true, version: true } }),
   definitions: await prisma.achievementDefinition.findMany({ take: 100, orderBy: { code: "asc" } }),
   entries: await prisma.competitionEntry.findMany({ take: 100, orderBy: { joinedAt: "desc" }, select: { id: true, competitionId: true, alias: true, disqualified: true, rank: true } }),
   awards: await prisma.earnedAchievement.findMany({ take: 100, orderBy: { awardedAt: "desc" }, select: { id: true, title: true, status: true, version: true } }),
   prizes: await prisma.prizeAward.findMany({ take: 100, orderBy: { updatedAt: "desc" }, select: { id: true, label: true, status: true, version: true } }),
   audits: await prisma.auditEvent.findMany({ where: { entity: { in: ["COMPETITION", "ACHIEVEMENT", "ACHIEVEMENT_DEFINITION", "PRIZE"] } },
     take: 100, orderBy: { createdAt: "desc" }, select: { id: true, action: true, detail: true, createdAt: true } }) };
}
export async function adminCompetitionMutation(user: AuthUser, raw: z.infer<typeof adminCompetitionSchema>) {
 assertPlatformAdmin(user); const input = adminCompetitionSchema.parse(raw);
 // Validate the existing question/scoring pipeline before reserving the blueprint.
 if (input.action === "publish" || input.action === "validate") {
   const c = await prisma.competition.findUnique({ where: { id: input.id } }); if (!c) throw missing();
   await mutateAdminMock(user, { action: "validate", id: c.mockExamId, version: c.mockVersion });
 }
 return atomic(async (tx) => {
   if (input.action === "definition") { const d = await tx.achievementDefinition.create({ data: input.definition }); await audit(tx, user.id, "ACHIEVEMENT_DEFINITION", d.id, "DEFINITION_CREATED_DRAFT"); return { id: d.id }; }
   if (input.action === "definition-status" || input.action === "definition-edit") {
     const d = await tx.achievementDefinition.findUnique({ where: { id: input.id } }); if (!d) throw missing(); if (d.version !== input.version) throw new ConflictApiError("Definition changed");
     if (input.action === "definition-edit" && (d.status !== "DRAFT" || await tx.earnedAchievement.count({ where: { definitionId: d.id } }))) throw new ValidationApiError("Create a new definition to change an earned achievement rule");
     await tx.achievementDefinition.update({ where: { id: d.id }, data: { ...(input.action === "definition-edit" ? input.definition : { status: input.publish ? "PUBLISHED" : "DRAFT" }), version: { increment: 1 } } });
     if (input.action === "definition-status" && !input.publish) await tx.earnedAchievement.updateMany({ where: { definitionId: d.id }, data: { shareHash: null, version: { increment: 1 } } });
     await audit(tx, user.id, "ACHIEVEMENT_DEFINITION", d.id, input.action === "definition-edit" ? "DEFINITION_EDITED" : "DEFINITION_PUBLICATION_CHANGED"); return { saved: true };
   }
   if (input.action === "award-status") {
     const a = await tx.earnedAchievement.findUnique({ where: { id: input.id }, include: { definition: true } }); if (!a) throw missing(); if (a.version !== input.version) throw new ConflictApiError("Award changed");
     if (input.revoke) await revoke(tx, user.id, a.id, "ADMIN", input.reason);
     else { const proof = a.definition.status === "PUBLISHED" ? await qualification(tx, a.userId, a.definition, a.scope) : null;
       if (!proof) throw new ValidationApiError("Current persisted evidence does not qualify");
       await tx.earnedAchievement.update({ where: { id: a.id }, data: { status: "ACTIVE", revocationSource: null, explanation: proof.explanation, evidence: proof.evidence, version: { increment: 1 } } });
       await audit(tx, user.id, "ACHIEVEMENT", a.id, "ACHIEVEMENT_CORRECTED_RESTORED", input.reason); }
     return { saved: true };
   }
   if (input.action === "prize") {
     const p = await tx.prizeAward.findUnique({ where: { id: input.id }, include: { achievement: { include: { definition: true } } } }); if (!p) throw missing();
     if (p.version !== input.version) throw new ConflictApiError("Prize changed");
     if (p.achievement.status !== "ACTIVE" || p.status === "FULFILLED" || (input.status === "FULFILLED" && p.status !== "APPROVED")) throw new ValidationApiError("Prize transition is not allowed");
     if (["APPROVED", "FULFILLED"].includes(input.status) && (p.achievement.definition.status !== "PUBLISHED" || !await qualification(tx, p.achievement.userId, p.achievement.definition, p.achievement.scope))) throw new ValidationApiError("Current award eligibility requires review");
     await tx.prizeAward.update({ where: { id: p.id }, data: { status: input.status, decision: input.reason, version: { increment: 1 } } });
     await audit(tx, user.id, "PRIZE", p.id, `PRIZE_${input.status}`, `${p.status} -> ${input.status}: ${input.reason}`); return { saved: true };
   }
   if (input.action === "create") {
     const v = competitionSchema.parse(input.competition); const mock = await tx.mockExam.findUnique({ where: { id: v.mockExamId } }); if (!mock) throw missing();
     const c = await tx.competition.create({ data: { ...v, startsAt: new Date(v.startsAt), endsAt: new Date(v.endsAt), mockVersion: mock.version } });
     await audit(tx, user.id, "COMPETITION", c.id, "COMPETITION_CREATED_DRAFT"); return { id: c.id };
   }
   const c = await getCompetition(tx, input.id); if (c.version !== input.version) throw new ConflictApiError("Competition changed");
   if (input.action === "recalculate" && c.status !== "COMPLETED") throw new ValidationApiError("Only completed results can be corrected");
   if (input.action === "edit") {
     if (c.status !== "DRAFT") throw new ValidationApiError("Published competition configuration is immutable");
     const v = input.competition, mock = await tx.mockExam.findUnique({ where: { id: v.mockExamId } }); if (!mock) throw missing();
     await bump(tx, c, { ...v, startsAt: new Date(v.startsAt), endsAt: new Date(v.endsAt), mockVersion: mock.version });
   } else if (input.action === "publish" || input.action === "validate") {
     if (c.status !== "DRAFT" || new Date() >= c.startsAt) throw new ValidationApiError("Validate and publish a draft before its start time");
     await validateCompetition(tx, c); if (input.action === "validate") return { valid: true }; await bump(tx, c, { status: "PUBLISHED" });
   } else if (input.action === "cancel") {
     await bump(tx, c, { status: "CANCELLED", resultsVerifiedAt: null }); await tx.competitionEntry.updateMany({ where: { competitionId: c.id }, data: { rank: null } });
     const affected = await tx.competitionEntry.findMany({ where: { competitionId: c.id }, take: 1000, select: { userId: true } });
     for (const entry of affected) await inAppNotice(tx, entry.userId, `competition:${c.id}:cancelled:${c.version + 1}`, "COMPETITION_CANCELLED");
     const awards = await tx.earnedAchievement.findMany({ where: { scope: c.id, status: "ACTIVE" }, select: { id: true } });
     for (const a of awards) await revoke(tx, user.id, a.id, "AUTO", input.reason!);
   } else if (input.action === "moderate") {
     if (c.status === "CANCELLED") throw missing();
     const e = await tx.competitionEntry.findFirst({ where: { id: input.entryId, competitionId: c.id } }); if (!e) throw missing();
     await tx.competitionEntry.update({ where: { id: e.id }, data: { disqualified: input.disqualified, decision: input.reason } });
     await settle(tx, c, user.id);
   } else await settle(tx, c, user.id, input.action === "close");
   await audit(tx, user.id, "COMPETITION", c.id, `COMPETITION_${input.action.toUpperCase()}`, "reason" in input ? input.reason : undefined);
   return { saved: true };
 });
}
