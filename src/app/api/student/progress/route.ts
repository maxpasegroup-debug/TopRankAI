import { studentRead } from "@/server/api/student-handler";
import { getStudentEvidence } from "@/server/journey/progress";
export const GET = studentRead((user, request) => getStudentEvidence(user, new URL(request.url).searchParams.get("timezone") ?? "Asia/Kolkata"));
