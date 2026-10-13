import { adminMutation } from "@/server/api/admin-handler";
import { readBoundedJson } from "@/server/api/json-body";
import { assertConfirmedImport, confirmedContentImportSchema } from "@/server/content/import-preview";
import { importContentDrafts } from "@/server/content/authoring";
export const POST = adminMutation(confirmedContentImportSchema, (user, input) => importContentDrafts(user, assertConfirmedImport(input)), 512 * 1024, readBoundedJson);
