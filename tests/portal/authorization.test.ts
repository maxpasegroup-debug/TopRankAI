import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/server/auth/session";
const db = vi.hoisted(() => { const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() }); return { user: model(), school: model(), schoolMembership: model(), studentParentRelationship: model(), schoolEnrollment: model(), schoolStaffAssignment: model(), auditEvent: model() }; });
vi.mock("@/server/db", () => ({ prisma: db }));
import { freshActor, tenantContext, guardianAccess, schoolStudentAccess, validConsent, displayConsentStatus } from "@/server/portal/authorization";
const actor = (role: AuthUser["role"]): AuthUser => ({ id: "viewer", role, email: "fixture@example.test", name: "Fixture" });
const consent = () => ({ id: "enrollment", status: "ACTIVE", expiresAt: new Date("2099-01-01"), verifiedAt: new Date(), studentConsentAt: new Date(), parentAcceptedAt: new Date(), authorizationBasis: "Verified authorization", verificationReference: "offline-case-123", verifiedById: "operator", scopes: ["ACTIVITY", "MOCKS", "ACHIEVEMENTS", "ANNOUNCEMENTS", "SUPPORT", "COUNSELLING"], studentId: "student", schoolId: "school", studentUserId: "student", parentUserId: "viewer" });
const school = () => ({ id: "school", status: "ACTIVE", name: "Fixture institution" });
const membership = (role = "TEACHER", duty = "TEACHING") => ({ id: "membership", schoolId: "school", userId: "viewer", status: "ACTIVE", role, duty, school: school() });
const context = (duty = "TEACHING", admin = false) => ({ actor: { ...actor(admin ? "SCHOOL_ADMIN" : "TEACHER"), status: "ACTIVE" }, school: school(), membership: membership(admin ? "ADMIN" : duty === "TEACHING" ? "TEACHER" : "STAFF", duty), isAdmin: admin });
beforeEach(() => {
 vi.resetAllMocks(); db.user.findUnique.mockResolvedValue({ ...actor("PARENT"), status: "ACTIVE" }); db.user.findFirst.mockResolvedValue({ id: "student", name: "Learner" });
 db.school.findUnique.mockResolvedValue(school()); db.schoolMembership.findMany.mockResolvedValue([membership()]); db.studentParentRelationship.findUnique.mockResolvedValue(consent()); db.schoolEnrollment.findUnique.mockResolvedValue(consent());
 db.schoolStaffAssignment.findUnique.mockResolvedValue({ schoolId: "school", enrollmentId: "enrollment", membershipId: "membership", active: true });
});
describe("fresh identities and tenant isolation (mocked persistence)", () => {
 it.each(["STUDENT", "PARENT", "TEACHER", "SCHOOL_ADMIN", "PLATFORM_ADMIN"] as const)("accepts current active %s identity", async role => { db.user.findUnique.mockResolvedValue({ ...actor(role), status: "ACTIVE" }); expect((await freshActor(actor(role))).role).toBe(role); });
 it.each(["INVITED", "SUSPENDED", "DELETED"])("denies %s identity despite session role", async status => { db.user.findUnique.mockResolvedValue({ ...actor("PARENT"), status }); await expect(freshActor(actor("PARENT"))).rejects.toMatchObject({ status: 403 }); });
 it("denies missing identity", async () => { db.user.findUnique.mockResolvedValue(null); await expect(freshActor(actor("PARENT"))).rejects.toThrow(); });
 it("denies stale session role", async () => { db.user.findUnique.mockResolvedValue({ ...actor("TEACHER"), status: "ACTIVE" }); await expect(freshActor(actor("PARENT"))).rejects.toThrow(); });
 it.each(["STUDENT", "PARENT"] as const)("%s cannot enter school tenant", async role => { db.user.findUnique.mockResolvedValue({ ...actor(role), status: "ACTIVE" }); await expect(tenantContext(actor(role), "school")).rejects.toThrow(); });
 it("platform must select explicit tenant", async () => { db.user.findUnique.mockResolvedValue({ ...actor("PLATFORM_ADMIN"), status: "ACTIVE" }); await expect(tenantContext(actor("PLATFORM_ADMIN"))).rejects.toThrow(); });
 it("platform accepts explicitly selected active tenant", async () => { db.user.findUnique.mockResolvedValue({ ...actor("PLATFORM_ADMIN"), status: "ACTIVE" }); expect((await tenantContext(actor("PLATFORM_ADMIN"), "school")).isAdmin).toBe(true); });
 it.each(["SUSPENDED", "TRIAL"])("platform cannot read %s tenant", async status => { db.user.findUnique.mockResolvedValue({ ...actor("PLATFORM_ADMIN"), status: "ACTIVE" }); db.school.findUnique.mockResolvedValue({ ...school(), status }); await expect(tenantContext(actor("PLATFORM_ADMIN"), "school")).rejects.toThrow(); });
 it.each([{ choices: [] }, { choices: [membership(), membership()] }])("missing or ambiguous membership fails closed: %j", async ({ choices }) => { db.user.findUnique.mockResolvedValue({ ...actor("TEACHER"), status: "ACTIVE" }); db.schoolMembership.findMany.mockResolvedValue(choices); await expect(tenantContext(actor("TEACHER"))).rejects.toThrow(); });
 it.each([{ status: "SUSPENDED" }, { status: "REMOVED" }, { status: "INVITED" }, { schoolId: "other" }, { userId: "other" }, { duty: "UNVERIFIED" }, { role: "ADMIN", duty: "ADMIN" }, { school: { ...school(), status: "SUSPENDED" } }])("rejects invalid teacher membership %j", async change => { db.user.findUnique.mockResolvedValue({ ...actor("TEACHER"), status: "ACTIVE" }); db.schoolMembership.findMany.mockResolvedValue([{ ...membership(), ...change }]); await expect(tenantContext(actor("TEACHER"), "school")).rejects.toThrow(); });
 it.each([["TEACHER", "TEACHING"], ["STAFF", "MENTOR"], ["STAFF", "COUNSELLING"]])("accepts verified %s / %s duty", async (role, duty) => { db.user.findUnique.mockResolvedValue({ ...actor("TEACHER"), status: "ACTIVE" }); db.schoolMembership.findMany.mockResolvedValue([membership(role, duty)]); expect((await tenantContext(actor("TEACHER"), "school")).isAdmin).toBe(false); });
 it("teacher cannot request admin permission", async () => { db.user.findUnique.mockResolvedValue({ ...actor("TEACHER"), status: "ACTIVE" }); await expect(tenantContext(actor("TEACHER"), "school", db as never, true)).rejects.toThrow(); });
 it("verified institution admin is authorized", async () => { db.user.findUnique.mockResolvedValue({ ...actor("SCHOOL_ADMIN"), status: "ACTIVE" }); db.schoolMembership.findMany.mockResolvedValue([membership("ADMIN", "ADMIN")]); expect((await tenantContext(actor("SCHOOL_ADMIN"), "school", db as never, true)).isAdmin).toBe(true); });
});
describe("guardian scopes and live consent", () => {
 it.each([{ scopes: null }, { scopes: undefined }, { scopes: [] }, { scopes: "ACTIVITY" }, { scopes: [null] }, { scopes: ["ACTIVITY", "INVENTED"] }, { scopes: ["ACTIVITY", "ACTIVITY"] }])("malformed guardian scopes deny before learner access: %j", async change => {
   db.studentParentRelationship.findUnique.mockResolvedValue({ ...consent(), ...change });
   await expect(guardianAccess(actor("PARENT"), "student")).rejects.toMatchObject({ status: 403 });
   expect(db.user.findFirst).not.toHaveBeenCalled();
 });
 it("reads only its verified linked learner", async () => { expect((await guardianAccess(actor("PARENT"), "student")).student.id).toBe("student"); });
 it.each(["PENDING", "REVOKED", "REJECTED", "EXPIRED"])("denies %s relationship", async status => { db.studentParentRelationship.findUnique.mockResolvedValue({ ...consent(), status }); await expect(guardianAccess(actor("PARENT"), "student")).rejects.toThrow(); });
 it.each(["expiresAt", "verifiedAt", "studentConsentAt", "parentAcceptedAt", "authorizationBasis", "verificationReference", "verifiedById"])("missing %s never authorizes", async field => { db.studentParentRelationship.findUnique.mockResolvedValue({ ...consent(), [field]: null }); await expect(guardianAccess(actor("PARENT"), "student")).rejects.toThrow(); });
 it("expired active relationship loses access", async () => { db.studentParentRelationship.findUnique.mockResolvedValue({ ...consent(), expiresAt: new Date(0) }); await expect(guardianAccess(actor("PARENT"), "student")).rejects.toThrow(); });
 it.each([{ parentUserId: "another-parent" }, { studentUserId: "another-student" }])("wrong relationship owner %j fails", async change => { db.studentParentRelationship.findUnique.mockResolvedValue({ ...consent(), ...change }); await expect(guardianAccess(actor("PARENT"), "student")).rejects.toThrow(); });
 it("unlinked learner denied", async () => { db.studentParentRelationship.findUnique.mockResolvedValue(null); await expect(guardianAccess(actor("PARENT"), "student")).rejects.toThrow(); });
 it("linked A grants no access to B", async () => { await guardianAccess(actor("PARENT"), "student"); await expect(guardianAccess(actor("PARENT"), "student-B")).rejects.toThrow(); });
 it("student cannot impersonate guardian", async () => { db.user.findUnique.mockResolvedValue({ ...actor("STUDENT"), status: "ACTIVE" }); await expect(guardianAccess(actor("STUDENT"), "student")).rejects.toThrow(); });
 it("platform does not inherit guardian permission", async () => { db.user.findUnique.mockResolvedValue({ ...actor("PLATFORM_ADMIN"), status: "ACTIVE" }); await expect(guardianAccess(actor("PLATFORM_ADMIN"), "student")).rejects.toThrow(); });
 it("no counselling or support inheritance", async () => { expect((await guardianAccess(actor("PARENT"), "student")).scopes).toEqual(["ACTIVITY", "MOCKS", "ACHIEVEMENTS", "ANNOUNCEMENTS"]); });
 it("inactive learner cannot be read", async () => { db.user.findFirst.mockResolvedValue(null); await expect(guardianAccess(actor("PARENT"), "student")).rejects.toThrow(); });
 it("revocation applies without new login", async () => { await guardianAccess(actor("PARENT"), "student"); db.studentParentRelationship.findUnique.mockResolvedValue({ ...consent(), status: "REVOKED" }); await expect(guardianAccess(actor("PARENT"), "student")).rejects.toThrow(); });
});
describe("assigned staff / confidential scopes", () => {
 it.each([{ scopes: null }, { scopes: undefined }, { scopes: [] }, { scopes: "ACTIVITY" }, { scopes: [null] }, { scopes: ["ACTIVITY", "INVENTED"] }, { scopes: ["ACTIVITY", "ACTIVITY"] }])("malformed enrolment scopes deny before assignment or learner access: %j", async change => {
   db.schoolEnrollment.findUnique.mockResolvedValue({ ...consent(), ...change });
   await expect(schoolStudentAccess(context() as never, "student", db as never)).rejects.toMatchObject({ status: 403 });
   expect(db.schoolStaffAssignment.findUnique).not.toHaveBeenCalled(); expect(db.user.findFirst).not.toHaveBeenCalled();
 });
 it.each(["TEACHING", "MENTOR"])("%s can read assigned activity", async duty => { expect((await schoolStudentAccess(context(duty) as never, "student", db as never, "ACTIVITY")).student.id).toBe("student"); });
 it.each(["TEACHING", "MENTOR"])("%s cannot read counselling", async duty => { await expect(schoolStudentAccess(context(duty) as never, "student", db as never, "COUNSELLING")).rejects.toThrow(); });
 it("counsellor can read assigned counselling scope", async () => { expect((await schoolStudentAccess(context("COUNSELLING") as never, "student", db as never, "COUNSELLING")).scopes).toEqual(["COUNSELLING"]); });
 it.each(["ACTIVITY", "MOCKS", "ACHIEVEMENTS", "ANNOUNCEMENTS", "SUPPORT"] as const)("counsellor does not inherit %s", async scope => { await expect(schoolStudentAccess(context("COUNSELLING") as never, "student", db as never, scope)).rejects.toThrow(); });
 it("school admin cannot read counselling", async () => { await expect(schoolStudentAccess(context("ADMIN", true) as never, "student", db as never, "COUNSELLING")).rejects.toThrow(); });
 it("admin has enrolment-scoped reports without assignment", async () => { db.schoolStaffAssignment.findUnique.mockResolvedValue(null); await expect(schoolStudentAccess(context("ADMIN", true) as never, "student", db as never, "ACTIVITY")).resolves.toBeDefined(); });
 it.each([null, { active: false }, { active: true, schoolId: "other" }, { active: true, enrollmentId: "other" }, { active: true, membershipId: "other" }])("bad assignment %j denies student read", async change => { db.schoolStaffAssignment.findUnique.mockResolvedValue(change && { schoolId: "school", enrollmentId: "enrollment", membershipId: "membership", ...change }); await expect(schoolStudentAccess(context() as never, "student", db as never)).rejects.toThrow(); });
 it.each([{ schoolId: "other" }, { studentId: "other" }, { status: "REVOKED" }, { status: "PENDING" }, { expiresAt: new Date(0) }, { studentConsentAt: null }, { scopes: [] }])("bad enrolment %j denies access", async change => { db.schoolEnrollment.findUnique.mockResolvedValue({ ...consent(), ...change }); await expect(schoolStudentAccess(context() as never, "student", db as never)).rejects.toThrow(); });
 it("missing requested scope is denied", async () => { db.schoolEnrollment.findUnique.mockResolvedValue({ ...consent(), scopes: ["MOCKS"] }); await expect(schoolStudentAccess(context() as never, "student", db as never, "ACTIVITY")).rejects.toThrow(); });
 it("expiry boundary is exclusive", () => { const record = consent(); expect(validConsent(record, record.expiresAt)).toBe(false); });
 it("pending expiry is displayed explicitly", () => { expect(displayConsentStatus({ status: "PENDING", expiresAt: new Date(0) })).toBe("EXPIRED"); });
 it("revoked status is preserved after expiry", () => { expect(displayConsentStatus({ status: "REVOKED", expiresAt: new Date(0) })).toBe("REVOKED"); });
});
