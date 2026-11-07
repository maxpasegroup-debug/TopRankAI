import { prisma } from "@/server/db";
import type { AuthUser } from "@/server/auth/session";
import { AuthorizationApiError } from "@/server/api/errors";
import type { Tx } from "@/server/commerce/transaction";
import { scopesSchema, type Scope } from "./validation";
import { sharingStudentWhere } from "@/server/auth/sharing";
export const denied = () => new AuthorizationApiError("Portal access is not authorized");
export async function freshActor(user: AuthUser, db: Tx = prisma, roles: readonly string[] = ["STUDENT", "PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"]) {
 const current = await db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, role: true, status: true } });
 if (!current || current.status !== "ACTIVE" || current.role !== user.role || !roles.includes(current.role)) throw denied();
 return current;
}
export function validConsent(record: { status: string; expiresAt: Date | null; verifiedAt: Date | null; studentConsentAt: Date | null;
 authorizationBasis: string | null; verificationReference: string | null; verifiedById: string | null; scopes: unknown }, now = new Date()) {
 return record.status === "ACTIVE" && record.expiresAt instanceof Date && record.expiresAt > now && Boolean(record.verifiedAt && record.studentConsentAt &&
   record.authorizationBasis && record.verificationReference && record.verifiedById) && scopesSchema.safeParse(record.scopes).success;
}
export function displayConsentStatus(record: { status: string; expiresAt: Date | null }, now = new Date()) {
 return ["PENDING", "ACTIVE"].includes(record.status) && record.expiresAt && record.expiresAt <= now ? "EXPIRED" : record.status;
}
export async function tenantContext(user: AuthUser, schoolId?: string, db: Tx = prisma, requireAdmin = false) {
 const actor = await freshActor(user, db, ["TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"]);
 if (actor.role === "PLATFORM_ADMIN") {
   if (!schoolId) throw denied();
   const school = await db.school.findUnique({ where: { id: schoolId } });
   if (!school || school.status !== "ACTIVE") throw denied();
   return { actor, school, membership: null, isAdmin: true };
 }
 const choices = await db.schoolMembership.findMany({ where: { userId: actor.id, status: "ACTIVE", ...(schoolId ? { schoolId } : {}), school: { status: "ACTIVE" } }, include: { school: true }, take: 2 });
 if (choices.length !== 1) throw denied();
 const membership = choices[0], school = membership.school;
 if (membership.userId !== actor.id || membership.status !== "ACTIVE" || school.status !== "ACTIVE" || (schoolId && membership.schoolId !== schoolId)) throw denied();
 const isAdmin = actor.role === "SCHOOL_ADMIN" && ["OWNER", "ADMIN"].includes(membership.role) && membership.duty === "ADMIN";
 const staff = actor.role === "TEACHER" && ((membership.role === "TEACHER" && membership.duty === "TEACHING") ||
   (membership.role === "STAFF" && ["MENTOR", "COUNSELLING"].includes(membership.duty)));
 if ((!isAdmin && !staff) || (requireAdmin && !isAdmin)) throw denied();
 return { actor, school, membership, isAdmin };
}
export type TenantContext = Awaited<ReturnType<typeof tenantContext>>;
export async function activeStudent(db: Tx, id: string) {
 const student = await db.user.findFirst({ where: { id, ...sharingStudentWhere() }, select: { id: true, name: true } });
 if (!student || student.id !== id) throw denied(); return student;
}
export async function guardianAccess(user: AuthUser, studentId: string, db: Tx = prisma) {
 const actor = await freshActor(user, db, ["PARENT"]);
 const relationship = await db.studentParentRelationship.findUnique({ where: { studentUserId_parentUserId: { studentUserId: studentId, parentUserId: actor.id } } });
 if (!relationship || relationship.parentUserId !== actor.id || relationship.studentUserId !== studentId || !relationship.parentAcceptedAt || !validConsent(relationship)) throw denied();
 const student = await activeStudent(db, studentId);
 const scopes = relationship.scopes.filter((s) => ["ACTIVITY", "MOCKS", "ACHIEVEMENTS", "ANNOUNCEMENTS"].includes(s)) as Scope[];
 if (!scopes.length) throw denied(); return { actor, student, scopes };
}
export async function schoolStudentAccess(context: TenantContext, studentId: string, db: Tx = prisma, requested?: Scope) {
 const enrollment = await db.schoolEnrollment.findUnique({ where: { schoolId_studentId: { schoolId: context.school.id, studentId } } });
 if (!enrollment || enrollment.schoolId !== context.school.id || enrollment.studentId !== studentId || !validConsent(enrollment)) throw denied();
 const student = await activeStudent(db, studentId);
 const allowed = context.isAdmin ? ["ACTIVITY", "MOCKS", "ACHIEVEMENTS", "ANNOUNCEMENTS", "SUPPORT"] :
   context.membership?.duty === "COUNSELLING" ? ["COUNSELLING"] : ["ACTIVITY", "MOCKS", "ACHIEVEMENTS", "ANNOUNCEMENTS", "SUPPORT"];
 if (!context.isAdmin) {
   const assignment = await db.schoolStaffAssignment.findUnique({ where: { enrollmentId_membershipId: { enrollmentId: enrollment.id, membershipId: context.membership!.id } } });
   if (!assignment || !assignment.active || assignment.schoolId !== context.school.id || assignment.enrollmentId !== enrollment.id || assignment.membershipId !== context.membership!.id) throw denied();
 }
 const scopes = enrollment.scopes.filter((s) => allowed.includes(s)) as Scope[];
 if (!scopes.length || (requested && !scopes.includes(requested))) throw denied();
 return { student, enrollment, scopes };
}
export async function portalAudit(db: Tx, actorId: string, schoolId: string | null, entityId: string, action: string, detail?: string) {
 await db.auditEvent.create({ data: { actorId, entity: schoolId ? `SCHOOL:${schoolId}` : "GUARDIAN", entityId, action, detail } });
}
