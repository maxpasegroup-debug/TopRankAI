import { requireRole } from "@/server/auth/session";
import { AdminAccounts } from "@/components/account/AdminAccounts";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRole(["PLATFORM_ADMIN"]); return <AdminAccounts />; }
