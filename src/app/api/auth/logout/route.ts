import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFailure, apiOk, getRequestId, handleApiError } from "@/server/api/responses";
import { ApiError } from "@/server/api/errors";
import { requireAuthOrigin } from "@/server/auth/request-security";
import { revokeSession, SESSION_COOKIE } from "@/server/auth/session";

async function logout(request: Request) {
  const requestId = getRequestId(request);

  try {
    const origin = requireAuthOrigin(request);
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      await revokeSession(token);
    }

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    const response = acceptsHtml ? NextResponse.redirect(new URL("/", origin), 303) : apiOk({ loggedOut: true }, requestId);

    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(request: Request) {
  return logout(request);
}

export async function GET(request: Request) {
  const response = apiFailure(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST to log out"), getRequestId(request));
  response.headers.set("Allow", "POST");
  return response;
}
