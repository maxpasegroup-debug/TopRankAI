import { studentRead } from "@/server/api/student-handler";
import { getStudyChoices } from "@/server/journey/command-centre";
export const GET = studentRead(getStudyChoices);
