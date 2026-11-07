import { z } from "zod";
import type { AuthUser } from "@/server/auth/session";
import { ConflictApiError, ValidationApiError } from "@/server/api/errors";
import { atomic, type Tx } from "@/server/commerce/transaction";
import { freshActor, tenantContext, guardianAccess, schoolStudentAccess, activeStudent, validConsent, displayConsentStatus, portalAudit, denied } from "./authorization";
import { portalMutationSchema, portalQuerySchema, scopesSchema, type Scope } from "./validation";
import { sharedSummary, csvCell } from "./reporting";
import { createInvitation, revokeInvitation } from "./invitations";
import { sharingStudentWhere } from "@/server/auth/sharing";
type Query = z.output<typeof portalQuerySchema>;
type Mutation = z.output<typeof portalMutationSchema>;
const now = () => new Date();
const checkVersion = (current: number, supplied: number) => { if (current !== supplied) throw new ConflictApiError("Access state changed; refresh before retrying"); };
function future(date: Date) { if (date <= now()) throw new ValidationApiError("Authorization window has expired"); }
function narrow(scopes: string[], requested?: Scope[]) {
 if (!scopesSchema.safeParse(scopes).success) throw denied();
 const selected = requested ?? scopes;
 if (!selected.length || selected.some(s => !scopes.includes(s))) throw denied(); return selected;
}
async function notice(tx: Tx, userId: string, eventKey: string) {
 // Portal notices are in-app only; no student evidence or invitation tokens leave this transaction.
 await tx.commerceNotification.upsert({ where: { userId_eventKey_channel: { userId, eventKey, channel: "IN_APP" } },
   create: { userId, eventKey, channel: "IN_APP", template: "PORTAL_UPDATED", message: "Your portal access or consent has changed.", status: "AVAILABLE" }, update: {} });
}
async function studentReport(tx: Tx, user: AuthUser, query: Query) {
 if (!query.studentId) throw denied();
 if (user.role === "PARENT") {
   const access = await guardianAccess(user, query.studentId, tx);
   const summary = await sharedSummary(tx, access.student, access.scopes);
   const announcements = access.scopes.includes("ANNOUNCEMENTS") ? await tx.schoolAnnouncement.findMany({ where: { status: "PUBLISHED", school: { status: "ACTIVE", enrollments: { some: {
     studentId: access.student.id, status: "ACTIVE", scopes: { has: "ANNOUNCEMENTS" }, expiresAt: { gt: now() }, studentConsentAt: { not: null } } } } },
     select: { id: true, title: true, message: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 25 }) : [];
   return { ...summary, announcements };
 }
 const context = await tenantContext(user, query.schoolId, tx);
 if (context.actor.role === "PLATFORM_ADMIN") {
   if (!query.reason) throw denied(); await portalAudit(tx, user.id, context.school.id, query.studentId, "REPORT_ACCESSED", query.reason);
 }
 const access = await schoolStudentAccess(context, query.studentId, tx);
 return sharedSummary(tx, access.student, access.scopes);
}
export async function readPortal(user: AuthUser, query: Query) {
 return atomic(async tx => {
   const actor = await freshActor(user, tx);
   if (query.mode === "student") return studentReport(tx, user, query);
   if (query.mode === "feedback") {
     if (!query.studentId) throw denied();
     if (actor.role === "STUDENT") {
       if (query.studentId !== actor.id || !query.schoolId) throw denied();
       const enrollment = await tx.schoolEnrollment.findUnique({ where: { schoolId_studentId: { schoolId: query.schoolId, studentId: actor.id } }, include: { school: true } });
       if (!enrollment || enrollment.school.status !== "ACTIVE" || !validConsent(enrollment)) throw denied();
       const channels = [...(enrollment.scopes.includes("SUPPORT") ? [false] : []), ...(enrollment.scopes.includes("COUNSELLING") ? [true] : [])];
       return tx.portalFeedback.findMany({ where: { enrollmentId: enrollment.id, OR: channels.map(confidential => ({ confidential })) }, select: { id: true, message: true, confidential: true, createdAt: true }, take: 25, orderBy: { createdAt: "desc" } });
     }
     const context = await tenantContext(user, query.schoolId, tx);
     const confidential = context.membership?.duty === "COUNSELLING";
     const access = await schoolStudentAccess(context, query.studentId, tx, confidential ? "COUNSELLING" : "SUPPORT");
     if (actor.role === "PLATFORM_ADMIN") { if (!query.reason) throw denied(); await portalAudit(tx, actor.id, context.school.id, access.student.id, "FEEDBACK_ACCESSED", query.reason); }
     return tx.portalFeedback.findMany({ where: { enrollmentId: access.enrollment.id, confidential, ...(confidential ? { authorId: actor.id } : {}) },
       select: { id: true, message: true, confidential: true, createdAt: true }, take: 25, orderBy: { createdAt: "desc" } });
   }
   if (query.mode === "export") {
     const context = await tenantContext(user, query.schoolId, tx, true);
     if (!query.reason) throw denied();
     const records = await tx.schoolEnrollment.findMany({ where: { schoolId: context.school.id, status: "ACTIVE", expiresAt: { gt: now() }, student: sharingStudentWhere() }, orderBy: { id: "asc" }, skip: (query.page - 1) * 25, take: 25 });
     const rows = ["Student,Completed missions,Completed lessons,Recorded minutes"];
     for (const record of records) {
       if (!validConsent(record) || !record.scopes.includes("ACTIVITY")) continue;
       const access = await schoolStudentAccess(context, record.studentId, tx, "ACTIVITY");
       const summary = await sharedSummary(tx, access.student, access.scopes);
       rows.push([access.student.name, summary.activity!.completedTasks, summary.activity!.completedLessons, summary.activity!.recordedMinutes].map(csvCell).join(","));
     }
     await portalAudit(tx, actor.id, context.school.id, context.school.id, "REPORT_EXPORTED", query.reason);
     return { csv: rows.join("\r\n"), page: query.page, boundedPageSize: 25 };
   }
   const notifications = await tx.commerceNotification.findMany({ where: { userId: actor.id, channel: "IN_APP", status: "AVAILABLE", template: "PORTAL_UPDATED" }, select: { id: true, message: true, readAt: true }, take: 25, orderBy: { createdAt: "desc" } });
   if (actor.role === "PARENT" || actor.role === "STUDENT") {
     const relationships = await tx.studentParentRelationship.findMany({ where: actor.role === "PARENT" ? { parentUserId: actor.id, student: sharingStudentWhere() } : { studentUserId: actor.id },
       include: { student: { select: { name: true, status: true } }, parent: { select: { name: true, status: true } } }, orderBy: { id: "asc" }, take: 100 });
     const guardians = relationships.map(r => ({ id: r.id, studentId: r.studentUserId, studentName: r.student.name, parentName: r.parent.name, scopes: r.scopes, version: r.version,
       status: displayConsentStatus(r), accessible: actor.role === "PARENT" && r.student.status === "ACTIVE" && Boolean(r.parentAcceptedAt) && validConsent(r), expiresAt: r.expiresAt,
       studentConsented: Boolean(r.studentConsentAt), parentAccepted: Boolean(r.parentAcceptedAt) }));
     const enrollments = actor.role === "STUDENT" ? await tx.schoolEnrollment.findMany({ where: { studentId: actor.id }, include: { school: { select: { name: true, status: true } } }, take: 100, orderBy: { id: "asc" } }) : [];
     return { role: actor.role, actorId: actor.id, guardians, enrollments: enrollments.map(e => ({ id: e.id, schoolId: e.schoolId, name: e.school.name, schoolStatus: e.school.status, status: displayConsentStatus(e), scopes: e.scopes, version: e.version, expiresAt: e.expiresAt })), notifications };
   }
   if (actor.role === "PLATFORM_ADMIN" && !query.schoolId) {
     if (!query.reason) throw denied(); await portalAudit(tx, actor.id, null, actor.id, "INSTITUTIONS_LISTED", query.reason);
     return { role: actor.role, schools: await tx.school.findMany({ select: { id: true, name: true, status: true, version: true }, take: 25, orderBy: { id: "asc" }, skip: (query.page - 1) * 25 }), notifications };
   }
   const context = await tenantContext(user, query.schoolId, tx);
   if (actor.role === "PLATFORM_ADMIN") { if (!query.reason) throw denied(); await portalAudit(tx, actor.id, context.school.id, context.school.id, "INSTITUTION_ACCESSED", query.reason); }
   const enrollments = await tx.schoolEnrollment.findMany({ where: { schoolId: context.school.id, student: sharingStudentWhere(), ...(context.isAdmin ? {} : { assignments: { some: { membershipId: context.membership!.id, active: true } }, status: "ACTIVE", expiresAt: { gt: now() } }) },
     include: { student: { select: { name: true, status: true } } }, take: 25, skip: (query.page - 1) * 25, orderBy: { id: "asc" } });
   const students = enrollments.filter(e => context.isAdmin || (validConsent(e) && e.student.status === "ACTIVE" && e.scopes.some(s => context.membership?.duty === "COUNSELLING" ? s === "COUNSELLING" : ["ACTIVITY", "MOCKS", "ACHIEVEMENTS", "ANNOUNCEMENTS", "SUPPORT"].includes(s)))).map(e => ({ id: e.id, studentId: e.studentId, name: e.student.name, status: displayConsentStatus(e), scopes: e.scopes, version: e.version }));
   const members = context.isAdmin ? await tx.schoolMembership.findMany({ where: { schoolId: context.school.id }, select: { id: true, role: true, duty: true, status: true, version: true, user: { select: { name: true } } }, take: 25, orderBy: { id: "asc" } }) : [];
   const invitations = context.isAdmin ? await tx.portalInvitation.findMany({ where: { schoolId: context.school.id }, select: { id: true, name: true, role: true, duty: true, status: true, expiresAt: true }, take: 25, orderBy: { createdAt: "desc" } }) : [];
   const announcements = await tx.schoolAnnouncement.findMany({ where: { schoolId: context.school.id, status: "PUBLISHED" }, select: { id: true, title: true, message: true, createdAt: true }, take: 25, orderBy: { createdAt: "desc" } });
   const audit = context.isAdmin ? await tx.auditEvent.findMany({ where: { entity: `SCHOOL:${context.school.id}` }, select: { id: true, action: true, createdAt: true }, take: 25, orderBy: { createdAt: "desc" } }) : [];
   return { role: actor.role, school: { id: context.school.id, name: context.school.name, profile: context.school.profile, version: context.school.version }, isAdmin: context.isAdmin, duty: context.membership?.duty, students, members, invitations, announcements, audit, notifications, page: query.page };
 });
}
export async function mutatePortal(user: AuthUser, raw: z.input<typeof portalMutationSchema>) {
 const input = portalMutationSchema.parse(raw);
 if (input.action === "invite") return createInvitation(user, input);
 if (input.action === "inviteRevoke") return revokeInvitation(user, input.id, input.reason);
 return atomic(async tx => {
   const actor = await freshActor(user, tx);
   if (input.action === "readNotification") {
     await tx.commerceNotification.updateMany({ where: { id: input.id, userId: actor.id, channel: "IN_APP", template: "PORTAL_UPDATED" }, data: { readAt: now() } }); return { updated: true };
   }
   if (input.action === "schoolCreate") {
     if (actor.role !== "PLATFORM_ADMIN") throw denied();
     const school = await tx.school.create({ data: { name: input.name, slug: input.slug, status: "ACTIVE" } });
     await portalAudit(tx, actor.id, school.id, school.id, "INSTITUTION_CREATED", input.reason); return { id: school.id };
   }
   if (input.action === "schoolStatus") {
     if (actor.role !== "PLATFORM_ADMIN") throw denied();
     const school = await tx.school.findUnique({ where: { id: input.schoolId } }); if (!school) throw denied(); checkVersion(school.version, input.version);
     const changed = await tx.school.updateMany({ where: { id: school.id, version: input.version }, data: { status: input.status, version: { increment: 1 } } }); if (!changed.count) throw new ConflictApiError();
     const members = await tx.schoolMembership.findMany({ where: { schoolId: school.id }, select: { userId: true } });
     await tx.session.updateMany({ where: { userId: { in: members.map(m => m.userId) }, revokedAt: null }, data: { revokedAt: now() } });
     await portalAudit(tx, actor.id, school.id, school.id, "INSTITUTION_STATUS_CHANGED", input.reason); return { id: school.id };
   }
   if (input.action === "guardianPropose") {
     if (actor.role !== "PLATFORM_ADMIN") throw denied(); future(input.expiresAt);
     await activeStudent(tx, input.studentId);
     const parent = await tx.user.findFirst({ where: { id: input.parentId, role: "PARENT", status: "ACTIVE" } }); if (!parent) throw denied();
     const key = { studentUserId: input.studentId, parentUserId: input.parentId };
     const existing = await tx.studentParentRelationship.findUnique({ where: { studentUserId_parentUserId: key } });
     if (existing && ["PENDING", "ACTIVE"].includes(displayConsentStatus(existing))) {
       if (existing.authorizationBasis === input.authorizationBasis && existing.verificationReference === input.verificationReference && existing.expiresAt?.getTime() === input.expiresAt.getTime() && existing.relationshipType === input.relationshipType && existing.scopes.join() === input.scopes.join()) return { id: existing.id };
       throw new ConflictApiError();
     }
     const data = { relationshipType: input.relationshipType, scopes: input.scopes, expiresAt: input.expiresAt, authorizationBasis: input.authorizationBasis, verificationReference: input.verificationReference, verifiedAt: now(), verifiedById: actor.id, status: "PENDING" as const, studentConsentAt: null, parentAcceptedAt: null };
     const relationship = await tx.studentParentRelationship.upsert({ where: { studentUserId_parentUserId: key }, create: { ...key, ...data }, update: { ...data, version: { increment: 1 } } });
     await portalAudit(tx, actor.id, null, relationship.id, "GUARDIAN_PROPOSED"); await notice(tx, input.studentId, `guardian:${relationship.id}:${relationship.version}`); await notice(tx, input.parentId, `guardian:${relationship.id}:${relationship.version}`); return { id: relationship.id };
   }
   if (input.action === "guardianDecision") {
     const record = await tx.studentParentRelationship.findUnique({ where: { id: input.id } });
     if (!record || !((actor.role === "STUDENT" && record.studentUserId === actor.id) || (actor.role === "PARENT" && record.parentUserId === actor.id))) throw denied(); checkVersion(record.version, input.version);
     if (input.decision === "ACCEPT") {
       if (displayConsentStatus(record) !== "PENDING" || !record.expiresAt || !record.verifiedAt || !record.verifiedById || !record.authorizationBasis || !record.verificationReference) throw denied();
       await activeStudent(tx, record.studentUserId); const parent = await tx.user.findFirst({ where: { id: record.parentUserId, role: "PARENT", status: "ACTIVE" } }); if (!parent) throw denied();
     }
     if (input.decision === "NARROW" && (displayConsentStatus(record) !== "ACTIVE" || !input.scopes)) throw denied();
     const scopes = ["ACCEPT", "NARROW"].includes(input.decision) ? narrow(record.scopes, input.scopes) : record.scopes;
     const studentConsentAt = input.decision === "ACCEPT" && actor.role === "STUDENT" ? now() : record.studentConsentAt;
     const parentAcceptedAt = input.decision === "ACCEPT" && actor.role === "PARENT" ? now() : record.parentAcceptedAt;
     const status = input.decision === "NARROW" ? "ACTIVE" : input.decision === "ACCEPT" ? (studentConsentAt && parentAcceptedAt ? "ACTIVE" : "PENDING") : input.decision === "REJECT" ? "REJECTED" : "REVOKED";
     if (input.decision === "REJECT" && record.status !== "PENDING") throw denied();
     const changed = await tx.studentParentRelationship.updateMany({ where: { id: record.id, version: input.version }, data: { status, scopes, studentConsentAt, parentAcceptedAt, version: { increment: 1 } } }); if (!changed.count) throw new ConflictApiError();
     await portalAudit(tx, actor.id, null, record.id, `GUARDIAN_${input.decision}`, input.reason); await notice(tx, record.parentUserId, `guardian:${record.id}:${record.version + 1}`); await notice(tx, record.studentUserId, `guardian:${record.id}:${record.version + 1}`); return { id: record.id };
   }
   if (input.action === "enrollmentDecision") {
     if (actor.role !== "STUDENT") throw denied();
     const record = await tx.schoolEnrollment.findUnique({ where: { id: input.id }, include: { school: true } }); if (!record || record.studentId !== actor.id) throw denied(); checkVersion(record.version, input.version);
     const scopes = ["ACCEPT", "NARROW"].includes(input.decision) ? narrow(record.scopes, input.scopes) : record.scopes;
     if (input.decision === "ACCEPT") {
       if (displayConsentStatus(record) !== "PENDING" || record.school.status !== "ACTIVE" || !record.authorizationBasis || !record.verificationReference || !record.verifiedAt || !record.verifiedById) throw denied();
       // Transfers invalidate the old tenant's enrolment and assignments in the same transaction.
       const old = await tx.schoolEnrollment.findMany({ where: { studentId: actor.id, status: "ACTIVE", id: { not: record.id } }, select: { id: true, schoolId: true } });
       for (const e of old) { await tx.schoolEnrollment.update({ where: { id: e.id }, data: { status: "REVOKED", version: { increment: 1 } } }); await tx.schoolStaffAssignment.updateMany({ where: { enrollmentId: e.id }, data: { active: false } }); await portalAudit(tx, actor.id, e.schoolId, e.id, "ENROLLMENT_TRANSFERRED", input.reason); }
     }
     if (input.decision === "REJECT" && record.status !== "PENDING") throw denied();
     if (input.decision === "NARROW" && (displayConsentStatus(record) !== "ACTIVE" || !input.scopes)) throw denied();
     const changed = await tx.schoolEnrollment.updateMany({ where: { id: record.id, version: input.version }, data: { status: ["ACCEPT", "NARROW"].includes(input.decision) ? "ACTIVE" : input.decision === "REJECT" ? "REJECTED" : "REVOKED", scopes, studentConsentAt: input.decision === "ACCEPT" ? now() : record.studentConsentAt, version: { increment: 1 } } }); if (!changed.count) throw new ConflictApiError();
     if (!["ACCEPT", "NARROW"].includes(input.decision)) await tx.schoolStaffAssignment.updateMany({ where: { enrollmentId: record.id }, data: { active: false } });
     await portalAudit(tx, actor.id, record.schoolId, record.id, `ENROLLMENT_${input.decision}`, input.reason); return { id: record.id };
   }
   if (!("schoolId" in input) || !input.schoolId) throw denied();
   const context = await tenantContext(user, input.schoolId, tx, input.action !== "feedback");
   if (input.action === "schoolUpdate") {
     checkVersion(context.school.version, input.version); const changed = await tx.school.updateMany({ where: { id: context.school.id, version: input.version }, data: { name: input.name, profile: input.profile, version: { increment: 1 } } }); if (!changed.count) throw new ConflictApiError();
   } else if (input.action === "enroll") {
     future(input.expiresAt); await activeStudent(tx, input.studentId);
     const key = { schoolId: context.school.id, studentId: input.studentId };
     const old = await tx.schoolEnrollment.findUnique({ where: { schoolId_studentId: key } });
     if (old && ["PENDING", "ACTIVE"].includes(displayConsentStatus(old))) {
       if (old.authorizationBasis === input.authorizationBasis && old.verificationReference === input.verificationReference && old.expiresAt.getTime() === input.expiresAt.getTime() && old.scopes.join() === input.scopes.join()) return { id: old.id };
       throw new ConflictApiError();
     }
     const data = { status: "PENDING" as const, scopes: input.scopes, expiresAt: input.expiresAt, authorizationBasis: input.authorizationBasis, verificationReference: input.verificationReference, verifiedById: actor.id, verifiedAt: now(), studentConsentAt: null };
     const e = await tx.schoolEnrollment.upsert({ where: { schoolId_studentId: key }, create: { ...key, ...data }, update: { ...data, version: { increment: 1 } } });
     await tx.schoolStaffAssignment.updateMany({ where: { enrollmentId: e.id }, data: { active: false } });
     await notice(tx, input.studentId, `enrollment:${e.id}:${e.version}`);
   } else if (input.action === "enrollmentRemove") {
     const enrollment = await tx.schoolEnrollment.findUnique({ where: { id: input.id } });
     if (!enrollment || enrollment.schoolId !== context.school.id) throw denied(); checkVersion(enrollment.version, input.version);
     const changed = await tx.schoolEnrollment.updateMany({ where: { id: enrollment.id, version: input.version }, data: { status: "REVOKED", version: { increment: 1 } } }); if (!changed.count) throw new ConflictApiError();
     await tx.schoolStaffAssignment.updateMany({ where: { enrollmentId: enrollment.id }, data: { active: false } }); await notice(tx, enrollment.studentId, `enrollment:${enrollment.id}:${enrollment.version + 1}`);
   } else if (input.action === "membership") {
     const member = await tx.schoolMembership.findUnique({ where: { id: input.id }, include: { user: { select: { role: true, status: true } } } });
     if (!member || member.schoolId !== context.school.id || member.userId === actor.id) throw denied(); checkVersion(member.version, input.version);
     const adminTarget = ["ADMIN", "OWNER"].includes(member.role);
     if (adminTarget && actor.role !== "PLATFORM_ADMIN") throw denied();
     if (input.duty === "ADMIN" ? (!adminTarget || member.user.role !== "SCHOOL_ADMIN") : (adminTarget || member.user.role !== "TEACHER")) throw denied();
     if (input.status === "ACTIVE" && member.user.status !== "ACTIVE") throw denied();
     const changed = await tx.schoolMembership.updateMany({ where: { id: member.id, version: input.version }, data: { status: input.status, duty: input.duty, role: input.duty === "ADMIN" ? member.role : input.duty === "TEACHING" ? "TEACHER" : "STAFF", version: { increment: 1 } } }); if (!changed.count) throw new ConflictApiError();
     await tx.schoolStaffAssignment.updateMany({ where: { membershipId: member.id }, data: { active: false } });
     await tx.session.updateMany({ where: { userId: member.userId, revokedAt: null }, data: { revokedAt: now() } });
   } else if (input.action === "assign") {
     const e = await tx.schoolEnrollment.findUnique({ where: { id: input.enrollmentId } });
     const m = await tx.schoolMembership.findUnique({ where: { id: input.membershipId }, include: { user: { select: { role: true, status: true } } } });
     if (!e || !m || e.schoolId !== context.school.id || m.schoolId !== context.school.id) throw denied();
     if (input.active && (!validConsent(e) || m.status !== "ACTIVE" || m.user.role !== "TEACHER" || m.user.status !== "ACTIVE" || !["TEACHING", "MENTOR", "COUNSELLING"].includes(m.duty))) throw denied();
     await tx.schoolStaffAssignment.upsert({ where: { enrollmentId_membershipId: { enrollmentId: e.id, membershipId: m.id } }, create: { schoolId: context.school.id, enrollmentId: e.id, membershipId: m.id, active: input.active }, update: { active: input.active } });
   } else if (input.action === "feedback") {
     if (context.isAdmin || Boolean(context.membership?.duty === "COUNSELLING") !== input.confidential) throw denied();
     const access = await schoolStudentAccess(context, input.studentId, tx, input.confidential ? "COUNSELLING" : "SUPPORT");
     const key = { authorId: actor.id, requestKey: input.requestKey }; const old = await tx.portalFeedback.findUnique({ where: { authorId_requestKey: key } });
     if (old && (old.enrollmentId !== access.enrollment.id || old.message !== input.message || old.confidential !== input.confidential)) throw new ConflictApiError();
     await tx.portalFeedback.upsert({ where: { authorId_requestKey: key }, create: { ...key, enrollmentId: access.enrollment.id, message: input.message, confidential: input.confidential }, update: {} });
     await notice(tx, access.student.id, `feedback:${actor.id}:${input.requestKey}`);
   } else if (input.action === "announce") {
     const old = await tx.schoolAnnouncement.findUnique({ where: { requestKey: input.requestKey } });
     if (old && (old.schoolId !== context.school.id || old.title !== input.title || old.message !== input.message)) throw new ConflictApiError();
     await tx.schoolAnnouncement.upsert({ where: { requestKey: input.requestKey }, create: { schoolId: context.school.id, requestKey: input.requestKey, title: input.title, message: input.message }, update: {} });
   } else if (input.action === "announcementWithdraw") {
     const a = await tx.schoolAnnouncement.findUnique({ where: { id: input.id } }); if (!a || a.schoolId !== context.school.id) throw denied();
     await tx.schoolAnnouncement.update({ where: { id: a.id }, data: { status: "WITHDRAWN" } });
   } else throw denied();
   await portalAudit(tx, actor.id, context.school.id, "id" in input ? input.id : context.school.id, input.action.toUpperCase(), "reason" in input ? input.reason : undefined);
   return { updated: true };
 });
}
