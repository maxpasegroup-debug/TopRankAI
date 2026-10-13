import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireAuth();
  // Navigation is not authorization: each destination rechecks its own scope.
  switch (user.role) {
    case "STUDENT": redirect("/home");
    case "PARENT": redirect("/parent");
    case "TEACHER": redirect("/teacher");
    case "SCHOOL_ADMIN": redirect("/school");
    case "PLATFORM_ADMIN": redirect("/admin/portals");
    default: redirect("/unauthorized");
  }
}
