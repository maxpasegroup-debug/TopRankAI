import { studentRead } from "@/server/api/student-handler";
import { previewJourneyPlan } from "@/server/journey/service";
import { dateSchema } from "@/server/journey/validation";
export const GET = studentRead((user, request) => { const start = new URL(request.url).searchParams.get("startDate"); return previewJourneyPlan(user, undefined, start ? dateSchema.parse(start) : undefined); });
