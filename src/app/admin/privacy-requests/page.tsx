import { requireRole } from "@/server/auth/session";
import { PrivacyRequests } from "@/components/account/PrivacyRequests";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRole(["PLATFORM_ADMIN"]); return <PrivacyRequests operator />; }
