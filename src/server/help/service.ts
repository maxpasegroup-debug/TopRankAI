import { z } from "zod";
import type { AuthUser } from "@/server/auth/session";
import { assertStudent } from "@/server/student/service";
import { prisma } from "@/server/db";
import { ConflictApiError } from "@/server/api/errors";
export const helpSchema = z.object({ requestKey: z.uuid(), subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000) }).strict();
const select = { id: true, subject: true, message: true, status: true, response: true, version: true, createdAt: true, updatedAt: true };
export async function listHelpRequests(user: AuthUser) {
  assertStudent(user);
  return prisma.helpRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, select });
}
export async function createHelpRequest(user: AuthUser, input: z.infer<typeof helpSchema>) {
  assertStudent(user);
  input = helpSchema.parse(input);
  const result = await prisma.helpRequest.upsert({ where: { userId_requestKey: { userId: user.id, requestKey: input.requestKey } },
    create: { userId: user.id, ...input }, update: {}, select });
  if (result.subject !== input.subject || result.message !== input.message) throw new ConflictApiError("This request identifier was already used");
  return result;
}
