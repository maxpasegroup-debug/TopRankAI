import { adminRead } from "@/server/api/admin-handler";
import { candidateMonitor } from "@/server/admin/candidates";
import { ValidationApiError } from "@/server/api/errors";

export const GET = adminRead((admin, request) => {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? "1");
  const query = params.get("q") ?? "";
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new ValidationApiError("Invalid page number");
  if (query.length > 80) throw new ValidationApiError("Search text is too long");
  return candidateMonitor(admin, { page, query });
});
