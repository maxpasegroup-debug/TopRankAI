import { studentRead, studentMutation } from "@/server/api/student-handler";
import { getInbox, readInbox, inboxMutationSchema } from "@/server/notifications/service";
export const GET = studentRead((user, request) => { const query = new URL(request.url).searchParams; return getInbox(user, { page: query.get("page") ?? 1, unread: query.get("unread") ?? "false" }); });
export const POST = studentMutation(inboxMutationSchema, readInbox);
