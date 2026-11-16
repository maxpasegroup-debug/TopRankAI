import { requireRole } from "@/server/auth/session";
import { assertPlatformAdmin } from "@/server/admin/authorization";
import { AdminMocks } from "@/components/mock/AdminMocks";
import { PageContainer } from "@/components/ui/PageContainer";
export const dynamic = "force-dynamic";
export default async function Page() {
 assertPlatformAdmin(await requireRole(["PLATFORM_ADMIN"]));
 return <PageContainer><AdminMocks /></PageContainer>;
}
