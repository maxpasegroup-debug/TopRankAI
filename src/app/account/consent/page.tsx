import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AccountConsent } from "@/components/account/AccountConsent";
export const dynamic = "force-dynamic";
export default async function Page() { const user = await getCurrentUser(true); if (!user) redirect("/login"); if (user.role !== "STUDENT") redirect("/workspace"); return <AccountConsent />; }
