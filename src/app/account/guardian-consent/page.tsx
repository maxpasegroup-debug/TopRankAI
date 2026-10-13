import { requireRole } from "@/server/auth/session";
import { GuardianConsent } from "@/components/account/GuardianConsent";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRole(["PARENT"]); return <GuardianConsent />; }
