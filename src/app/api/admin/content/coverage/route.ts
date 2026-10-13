import { adminRead } from "@/server/api/admin-handler";
import { getLaunchContentCoverage } from "@/server/content/coverage";
export const GET = adminRead(user => getLaunchContentCoverage(user));
