import { studentRead } from "@/server/api/student-handler";
import { getSiaGuidance } from "@/server/sia/service";
export const GET = studentRead((user, request) => getSiaGuidance(user, new URL(request.url).searchParams.get("timezone") ?? "Asia/Kolkata"));
