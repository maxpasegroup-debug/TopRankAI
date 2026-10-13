import { z } from "zod";
import { adminMutation } from "@/server/api/admin-handler";
import { readBoundedJson } from "@/server/api/json-body";
import { previewContentImport } from "@/server/content/import-preview";
export const POST = adminMutation(z.unknown(), async (_user, input) => previewContentImport(input), 512 * 1024, readBoundedJson);
