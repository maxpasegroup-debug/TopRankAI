import { z } from "zod";
import { prisma } from "@/server/db";
import { assertStudent } from "@/server/student/service";
import type { AuthUser } from "@/server/auth/session";
import { AuthorizationApiError, ValidationApiError } from "@/server/api/errors";
import { requireResourceAccess } from "@/server/commerce/access";
import { safeResourceUrl } from "./resource-url";
export const saveResourceSchema = z.object({ resourceId: z.string().min(1).max(100), saved: z.boolean() }).strict();
const published = { status: "PUBLISHED" as const, active: true };
export async function saveResource(user: AuthUser, input: z.infer<typeof saveResourceSchema>) {
  assertStudent(user);
  if (!input.saved) {
    await prisma.studentSavedResource.deleteMany({ where: { userId: user.id, resourceId: input.resourceId } });
    return { saved: false };
  }
  const resource = await prisma.learningResource.findFirst({ where: { id: input.resourceId, ...published, lesson: { ...published, chapter: { ...published, subject: published } } }, select: { id: true, lessonId: true } });
  if (!resource) throw new ValidationApiError("Resource was not found");
  await requireResourceAccess("LESSON", resource.lessonId, user);
  await prisma.studentSavedResource.upsert({ where: { userId_resourceId: { userId: user.id, resourceId: resource.id } }, create: { userId: user.id, resourceId: resource.id }, update: {} });
  return { saved: true };
}
export async function listSavedResources(user: AuthUser, cursor?: string) {
  assertStudent(user);
  const rows = await prisma.studentSavedResource.findMany({ where: { userId: user.id, ...(cursor ? { resourceId: { gt: cursor } } : {}),
    resource: { ...published, lesson: { ...published, chapter: { ...published, subject: published } } } }, take: 51, orderBy: { resourceId: "asc" },
    select: { resourceId: true, resource: { select: { title: true, url: true, reference: true, type: true, lessonId: true, lesson: { select: { slug: true, chapter: { select: { slug: true, subject: { select: { slug: true } } } } } } } } } });
  const records = [];
  for (const row of rows.slice(0, 50)) {
    // Re-check current entitlement; never leak paid links from old bookmarks.
    try { await requireResourceAccess("LESSON", row.resource.lessonId, user); }
    catch (error) { if (error instanceof AuthorizationApiError) continue; throw error; }
    const resource = row.resource;
    records.push({ id: row.resourceId, title: resource.title, type: resource.type, url: safeResourceUrl(resource.url), reference: resource.reference,
      href: `/learn/${resource.lesson.chapter.subject.slug}/${resource.lesson.chapter.slug}/${resource.lesson.slug}` });
  }
  return { records, nextCursor: rows.length > 50 ? rows[49].resourceId : null };
}
export async function getSavedResourceState(user: AuthUser, resourceId: string) {
  assertStudent(user);
  return { saved: Boolean(await prisma.studentSavedResource.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId } }, select: { resourceId: true } })) };
}
