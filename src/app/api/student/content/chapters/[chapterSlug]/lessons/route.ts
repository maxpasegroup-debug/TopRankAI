import { AuthenticationApiError } from "@/server/api/errors";
import { apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { getCurrentUser } from "@/server/auth/session";
import { listLessonsForChapter, requireStudentContentAccess } from "@/server/content/service";
import { slugParamSchema } from "@/server/content/validation";

export async function GET(request: Request, context: { params: Promise<{ chapterSlug: string }> }) {
  const requestId = getRequestId(request);

  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthenticationApiError();
    requireStudentContentAccess(user);

    const { chapterSlug } = slugParamSchema.required({ chapterSlug: true }).parse(await context.params);
    const { subjectSlug } = slugParamSchema.parse({ subjectSlug: new URL(request.url).searchParams.get("subjectSlug") ?? undefined });

    return apiOk(await listLessonsForChapter(chapterSlug, subjectSlug), requestId, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
