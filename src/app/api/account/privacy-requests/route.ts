import { getCurrentUser } from "@/server/auth/session";
import { AuthenticationApiError, AuthorizationApiError } from "@/server/api/errors";
import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { requireAuthOrigin, readAuthJson } from "@/server/auth/request-security";
import { createPrivacyRequest, listPrivacyRequests, privacyReplySchema, privacyRequestSchema, replyPrivacyRequest } from "@/server/auth/privacy-requests";

// Consent-only sessions may exercise account rights, never ordinary student APIs.
async function accountUser() {
  const user = await getCurrentUser(true);
  if (!user) throw new AuthenticationApiError();
  if (!["STUDENT", "PARENT"].includes(user.role)) throw new AuthorizationApiError();
  return user;
}
export async function GET(request: Request) {
  const id = getRequestId(request);
  try { const user = await accountUser();
    return apiOk(await listPrivacyRequests(user, new URL(request.url).searchParams.get("page") ?? 1), id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, id); }
}
export async function POST(request: Request) {
  const id = getRequestId(request);
  try { requireAuthOrigin(request); const user = await accountUser();
    return apiOk(await createPrivacyRequest(user, privacyRequestSchema.parse(await readAuthJson(request))), id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, id); }
}
export async function PATCH(request: Request) {
  const id = getRequestId(request);
  try { requireAuthOrigin(request); const user = await accountUser();
    return apiOk(await replyPrivacyRequest(user, privacyReplySchema.parse(await readAuthJson(request))), id, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, id); }
}
