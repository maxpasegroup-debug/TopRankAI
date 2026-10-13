import { adminMutation, adminRead } from "@/server/api/admin-handler";
import { readBoundedJson } from "@/server/api/json-body";
import { studioMutationSchema } from "@/server/content/studio-validation";
import { getStudioOverview, mutateStudio } from "@/server/content/studio";
export const GET = adminRead(getStudioOverview);
export const POST = adminMutation(studioMutationSchema, mutateStudio, 256 * 1024, readBoundedJson);
