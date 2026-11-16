import type { AuthUser } from "@/server/auth/session";
import { AuthorizationApiError } from "@/server/api/errors";

export function assertPlatformAdmin(user: AuthUser) {
  if (user.role !== "PLATFORM_ADMIN") throw new AuthorizationApiError("Platform administrator access required");
}
