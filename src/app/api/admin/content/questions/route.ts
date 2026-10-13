import { adminRead, adminMutation } from "@/server/api/admin-handler";
import { prisma } from "@/server/db";
import { manageQuestion, questionMutationSchema, questionRevision } from "@/server/question/authoring";
import { editorialFingerprint } from "@/server/content/editorial";
import { readBoundedJson } from "@/server/api/json-body";
import { z } from "zod";
export const POST = adminMutation(questionMutationSchema, manageQuestion, 64 * 1024, readBoundedJson);
export const GET = adminRead(async (_, request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const record = await questionRevision(prisma, z.string().min(1).max(100).parse(id));
    const source = await prisma.contentSource.findUnique({ where: { entity_entityId: { entity: "QUESTION", entityId: id } } });
    return { record, source, fingerprint: editorialFingerprint(record) };
  }
  const rows = await prisma.question.findMany({ take: 101, orderBy: { code: "asc" }, select: { id: true, code: true, text: true, type: true, difficulty: true, language: true, status: true, reviewStatus: true, explanation: true,
    subject: { select: { name: true } }, chapter: { select: { title: true } } } });
  return { records: rows.slice(0, 100).map(({ explanation, ...row }) => ({ ...row, hasExplanation: Boolean(explanation) })), truncated: rows.length > 100 };
});
