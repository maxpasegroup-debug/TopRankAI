import { studentMutation, studentRead } from "@/server/api/student-handler";
import { getCommandCentre, addPlannedTask } from "@/server/journey/command-centre";
import { plannedTaskSchema, timezoneSchema, dateSchema } from "@/server/journey/validation";
export const GET = studentRead((user, request) => { const query = new URL(request.url).searchParams; const start = query.get("start"); return getCommandCentre(user, timezoneSchema.parse(query.get("timezone") ?? "Asia/Kolkata"), start ? dateSchema.parse(start).toISOString().slice(0, 10) : undefined); });
export const POST = studentMutation(plannedTaskSchema, addPlannedTask);
