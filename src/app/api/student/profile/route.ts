import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { getCurrentUser } from "@/server/auth/session";
import { AuthenticationApiError } from "@/server/api/errors";
import { getStudentProfile, updateStudentProfile } from "@/server/student/service";
import { studentProfileUpdateSchema } from "@/server/student/validation";
import { readAuthJson, requireAuthOrigin } from "@/server/auth/request-security";
import { AuthorizationApiError } from "@/server/api/errors";
import { candidateRoles } from "@/server/auth/roles";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new AuthenticationApiError();
    }

    return apiOk({ profile: await getStudentProfile(user) }, requestId, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new AuthenticationApiError();
    }

    if (!candidateRoles.includes(user.role as (typeof candidateRoles)[number])) throw new AuthorizationApiError("Only candidate accounts can access this resource");
    requireAuthOrigin(request);
    const input = studentProfileUpdateSchema.parse(await readAuthJson(request));

    return apiOk({ profile: await updateStudentProfile(user, input) }, requestId, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
