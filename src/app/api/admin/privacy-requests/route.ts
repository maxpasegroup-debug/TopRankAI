import { adminMutation, adminRead } from "@/server/api/admin-handler";
import { decidePrivacyRequest, listPrivacyQueue, privacyDecisionSchema } from "@/server/auth/privacy-requests";
export const GET = adminRead((user, request) => listPrivacyQueue(user, new URL(request.url).searchParams.get("page") ?? 1));
export const PATCH = adminMutation(privacyDecisionSchema, decidePrivacyRequest);
