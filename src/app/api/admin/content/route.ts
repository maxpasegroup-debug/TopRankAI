import { z } from "zod";
import { readBoundedJson } from "@/server/api/json-body";
import { adminMutation, adminRead } from "@/server/api/admin-handler";
import { draftRecordSchema, editorialEntitySchema } from "@/server/content/authoring-validation";
import { listEditorialContent, saveContentDraft } from "@/server/content/authoring";
export const GET = adminRead((user, request) => {
  const params = new URL(request.url).searchParams;
  return listEditorialContent(user, editorialEntitySchema.parse(params.get("entity")), z.string().min(1).max(100).optional().parse(params.get("cursor") ?? undefined));
});
export const POST = adminMutation(draftRecordSchema, saveContentDraft, 160 * 1024, readBoundedJson);
