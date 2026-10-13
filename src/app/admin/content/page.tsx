import { requireRole } from "@/server/auth/session";
import { StudioWorkspace } from "@/components/learning/StudioWorkspace";
import { PageContainer } from "@/components/ui/PageContainer";
export default async function Page() { await requireRole(["PLATFORM_ADMIN"]); return <PageContainer><StudioWorkspace /></PageContainer>; }
