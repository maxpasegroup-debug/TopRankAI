import { adminRead } from "@/server/api/admin-handler";
import { launchOverview, listEntitlements, listOperationalAudit } from "@/server/operations/launch";
import { ValidationApiError } from "@/server/api/errors";
export const GET = adminRead((user, request) => {
  const q = new URL(request.url).searchParams, mode = q.get("mode") ?? "overview";
  const page = q.get("page") ?? 1;
  if (mode === "overview") return launchOverview(user);
  if (mode === "access") return listEntitlements(user, { page, status: q.get("status") ?? "ALL", ...(q.get("userId") ? { userId: q.get("userId") } : {}) });
  if (mode === "audit") return listOperationalAudit(user, { page, ...(q.get("entity") ? { entity: q.get("entity") } : {}), ...(q.get("action") ? { action: q.get("action") } : {}) });
  throw new ValidationApiError("Unknown operations view");
});
