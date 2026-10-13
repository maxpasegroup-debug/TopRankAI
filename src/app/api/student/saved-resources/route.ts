import { z } from "zod";
import { studentMutation, studentRead } from "@/server/api/student-handler";
import { getSavedResourceState, listSavedResources, saveResource, saveResourceSchema } from "@/server/content/saved-resources";
export const PUT = studentMutation(saveResourceSchema, saveResource);
export const GET = studentRead((user, request) => {
  const params = new URL(request.url).searchParams;
  const resourceId = z.string().min(1).max(100).optional().parse(params.get("resourceId") ?? undefined);
  return resourceId ? getSavedResourceState(user, resourceId) : listSavedResources(user, z.string().min(1).max(100).optional().parse(params.get("cursor") ?? undefined));
});
