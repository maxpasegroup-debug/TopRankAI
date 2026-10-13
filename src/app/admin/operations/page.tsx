import { requireRole } from "@/server/auth/session";
import { PageContainer } from "@/components/ui/PageContainer";
import { LaunchOperations } from "@/components/commerce/LaunchOperations";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRole(["PLATFORM_ADMIN"]); return <PageContainer><LaunchOperations /></PageContainer>; }
