-- DropForeignKey
ALTER TABLE "CommerceGate" DROP CONSTRAINT "CommerceGate_featureCode_fkey";

-- DropForeignKey
ALTER TABLE "CommerceNotification" DROP CONSTRAINT "CommerceNotification_userId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationPreference" DROP CONSTRAINT "NotificationPreference_userId_fkey";

-- DropForeignKey
ALTER TABLE "CommerceOrder" DROP CONSTRAINT "CommerceOrder_packageId_fkey";

-- DropForeignKey
ALTER TABLE "CommerceOrder" DROP CONSTRAINT "CommerceOrder_userId_fkey";

-- DropForeignKey
ALTER TABLE "CommercePayment" DROP CONSTRAINT "CommercePayment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "CommerceReceipt" DROP CONSTRAINT "CommerceReceipt_orderId_fkey";

-- DropForeignKey
ALTER TABLE "CommerceRefund" DROP CONSTRAINT "CommerceRefund_orderId_fkey";

-- DropForeignKey
ALTER TABLE "CommerceRefund" DROP CONSTRAINT "CommerceRefund_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "Competition" DROP CONSTRAINT "Competition_mockExamId_fkey";

-- DropForeignKey
ALTER TABLE "CompetitionEntry" DROP CONSTRAINT "CompetitionEntry_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "CompetitionEntry" DROP CONSTRAINT "CompetitionEntry_competitionId_fkey";

-- DropForeignKey
ALTER TABLE "CompetitionEntry" DROP CONSTRAINT "CompetitionEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "EarnedAchievement" DROP CONSTRAINT "EarnedAchievement_definitionId_fkey";

-- DropForeignKey
ALTER TABLE "EarnedAchievement" DROP CONSTRAINT "EarnedAchievement_userId_fkey";

-- DropForeignKey
ALTER TABLE "Entitlement" DROP CONSTRAINT "Entitlement_featureCode_fkey";

-- DropForeignKey
ALTER TABLE "Entitlement" DROP CONSTRAINT "Entitlement_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Entitlement" DROP CONSTRAINT "Entitlement_userId_fkey";

-- DropForeignKey
ALTER TABLE "ParentProfile" DROP CONSTRAINT "ParentProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "PortalFeedback" DROP CONSTRAINT "PortalFeedback_authorId_fkey";

-- DropForeignKey
ALTER TABLE "PortalFeedback" DROP CONSTRAINT "PortalFeedback_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "PortalInvitation" DROP CONSTRAINT "PortalInvitation_acceptedUserId_fkey";

-- DropForeignKey
ALTER TABLE "PortalInvitation" DROP CONSTRAINT "PortalInvitation_issuerId_fkey";

-- DropForeignKey
ALTER TABLE "PortalInvitation" DROP CONSTRAINT "PortalInvitation_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "PrizeAward" DROP CONSTRAINT "PrizeAward_achievementId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolAnnouncement" DROP CONSTRAINT "SchoolAnnouncement_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolEnrollment" DROP CONSTRAINT "SchoolEnrollment_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolEnrollment" DROP CONSTRAINT "SchoolEnrollment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolEnrollment" DROP CONSTRAINT "SchoolEnrollment_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "SchoolMembership" DROP CONSTRAINT "SchoolMembership_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolMembership" DROP CONSTRAINT "SchoolMembership_userId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolStaffAssignment" DROP CONSTRAINT "SchoolStaffAssignment_schoolId_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolStaffAssignment" DROP CONSTRAINT "SchoolStaffAssignment_schoolId_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "StudentParentRelationship" DROP CONSTRAINT "StudentParentRelationship_parentUserId_fkey";

-- DropForeignKey
ALTER TABLE "StudentParentRelationship" DROP CONSTRAINT "StudentParentRelationship_studentUserId_fkey";

-- DropForeignKey
ALTER TABLE "StudentParentRelationship" DROP CONSTRAINT "StudentParentRelationship_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "TeacherProfile" DROP CONSTRAINT "TeacherProfile_userId_fkey";

-- DropIndex
DROP INDEX "Chapter_status_idx";

-- DropIndex
DROP INDEX "Lesson_status_idx";

-- DropTable
DROP TABLE "AchievementDefinition";

-- DropTable
DROP TABLE "CommerceEvent";

-- DropTable
DROP TABLE "CommerceFeature";

-- DropTable
DROP TABLE "CommerceGate";

-- DropTable
DROP TABLE "CommerceNotification";

-- DropTable
DROP TABLE "NotificationPreference";

-- DropTable
DROP TABLE "CommerceOrder";

-- DropTable
DROP TABLE "CommercePackage";

-- DropTable
DROP TABLE "CommercePayment";

-- DropTable
DROP TABLE "CommerceReceipt";

-- DropTable
DROP TABLE "CommerceRefund";

-- DropTable
DROP TABLE "Competition";

-- DropTable
DROP TABLE "CompetitionEntry";

-- DropTable
DROP TABLE "EarnedAchievement";

-- DropTable
DROP TABLE "Entitlement";

-- DropTable
DROP TABLE "ParentProfile";

-- DropTable
DROP TABLE "PortalFeedback";

-- DropTable
DROP TABLE "PortalInvitation";

-- DropTable
DROP TABLE "PrizeAward";

-- DropTable
DROP TABLE "School";

-- DropTable
DROP TABLE "SchoolAnnouncement";

-- DropTable
DROP TABLE "SchoolEnrollment";

-- DropTable
DROP TABLE "SchoolMembership";

-- DropTable
DROP TABLE "SchoolStaffAssignment";

-- DropTable
DROP TABLE "StudentParentRelationship";

-- DropTable
DROP TABLE "TeacherProfile";

-- AlterEnum after removing legacy columns that also used UserRole.
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('CANDIDATE', 'STUDENT', 'PARENT', 'PLATFORM_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- DropEnum
DROP TYPE "ParentRelationshipType";

-- DropEnum
DROP TYPE "RelationshipStatus";

-- DropEnum
DROP TYPE "SchoolMemberRole";

-- DropEnum
DROP TYPE "SchoolMembershipStatus";

-- DropEnum
DROP TYPE "SchoolStatus";

-- RenameForeignKey
ALTER TABLE "StudentSavedResource" RENAME CONSTRAINT "StudentSavedResource_resource_fkey" TO "StudentSavedResource_resourceId_fkey";

-- RenameForeignKey
ALTER TABLE "StudentSavedResource" RENAME CONSTRAINT "StudentSavedResource_user_fkey" TO "StudentSavedResource_userId_fkey";
