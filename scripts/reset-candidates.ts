import "dotenv/config";
import { prisma } from "../src/server/db";

/**
 * Remove every non-administrator account so the candidate side can be rebuilt
 * from a clean slate. Administrator accounts are never touched.
 *
 * Candidate-owned rows (sessions, attempts, plans, notifications, progress,
 * subscription, AI usage logs) are removed by the database cascade. A few
 * tables use `onDelete: Restrict`, so those rows are deleted explicitly and
 * any authored content is reported instead of being destroyed silently.
 *
 * Usage:
 *   npm run db:reset-candidates            # report only
 *   npm run db:reset-candidates -- --apply # delete
 */

async function main() {
  const apply = process.argv.includes("--apply");

  const users = await prisma.user.findMany({
    where: { role: { not: "PLATFORM_ADMIN" } },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const ids = users.map((user) => user.id);

  console.log(`Non-admin accounts: ${users.length}`);
  for (const user of users) {
    console.log(`  ${user.email} · ${user.role} · ${user.status} · ${user.createdAt.toISOString().slice(0, 10)}`);
  }
  if (ids.length === 0) {
    console.log("Nothing to remove.");
    return;
  }

  const [auditEvents, privacyRequests, guardianGrants, knowledgeJobs, syllabuses, contentSources] = await Promise.all([
    prisma.auditEvent.count({ where: { actorId: { in: ids } } }),
    prisma.accountPrivacyRequest.count({
      where: { OR: [{ requesterId: { in: ids } }, { subjectId: { in: ids } }, { reviewerId: { in: ids } }] },
    }),
    prisma.guardianRegistrationGrant.count({
      where: { OR: [{ guardianId: { in: ids } }, { verifiedById: { in: ids } }] },
    }),
    prisma.contentKnowledgeJob.count({ where: { requestedById: { in: ids } } }),
    prisma.syllabusVersion.count({
      where: { OR: [{ authorId: { in: ids } }, { reviewerId: { in: ids } }] },
    }),
    prisma.contentSource.count({
      where: { OR: [{ authorId: { in: ids } }, { reviewerId: { in: ids } }] },
    }),
  ]);

  console.log(
    [
      `audit events: ${auditEvents}`,
      `privacy requests: ${privacyRequests}`,
      `guardian grants: ${guardianGrants}`,
      `knowledge jobs: ${knowledgeJobs}`,
      `syllabus versions authored/reviewed: ${syllabuses}`,
      `content sources authored/reviewed: ${contentSources}`,
    ].join(" · "),
  );

  if (syllabuses > 0 || contentSources > 0) {
    throw new Error(
      "A non-admin account authored or reviewed syllabus/content records. Reassign those records to an administrator before deleting accounts.",
    );
  }

  if (!apply) {
    console.log("Dry run. Re-run with --apply to delete.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
    await tx.accountPrivacyRequest.deleteMany({
      where: { OR: [{ requesterId: { in: ids } }, { subjectId: { in: ids } }, { reviewerId: { in: ids } }] },
    });
    await tx.guardianRegistrationGrant.deleteMany({
      where: { OR: [{ guardianId: { in: ids } }, { verifiedById: { in: ids } }] },
    });
    if (knowledgeJobs > 0) {
      await tx.contentKnowledgeJob.deleteMany({ where: { requestedById: { in: ids } } });
    }
    return tx.user.deleteMany({ where: { id: { in: ids } } });
  });

  console.log(`Deleted ${result.count} account(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
