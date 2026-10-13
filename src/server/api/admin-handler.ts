import { z } from "zod";
import type { AuthUser } from "@/server/auth/session";
import { getCurrentUser } from "@/server/auth/session";
import { AuthenticationApiError } from "./errors";
import { apiOk, getRequestId, handleApiError } from "./responses";
import { requireAuthOrigin, readAuthJson } from "@/server/auth/request-security";
import { assertPlatformAdmin } from "@/server/operations/service";
export function adminRead(handler: (user: AuthUser, request: Request) => Promise<unknown>) {
  return async (request: Request) => { const id = getRequestId(request);
    try { const user = await getCurrentUser(); if (!user) throw new AuthenticationApiError(); assertPlatformAdmin(user);
      return apiOk(await handler(user, request), id, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return handleApiError(error, id); }
  };
}
export function adminMutation<T extends z.ZodType>(schema: T, handler: (user: AuthUser, input: z.output<T>) => Promise<unknown>, bodyLimitBytes = 4096, reader: (request: Request, limitBytes: number) => Promise<unknown> = readAuthJson) {
  return async (request: Request) => { const id = getRequestId(request);
    try { const user = await getCurrentUser(); if (!user) throw new AuthenticationApiError(); assertPlatformAdmin(user);
      requireAuthOrigin(request); return apiOk(await handler(user, schema.parse(await reader(request, bodyLimitBytes))), id, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return handleApiError(error, id); }
  };
}
