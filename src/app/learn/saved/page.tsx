import { requireRole } from "@/server/auth/session";
import { candidateRoles } from "@/server/auth/roles";
import { SavedResources } from "@/components/learning/SavedResources";
import { PageContainer } from "@/components/ui/PageContainer";
import { AppShell } from "@/components/layout/AppShell";
export default async function Page() { await requireRole(candidateRoles); return <AppShell currentPath="/learn"><PageContainer><SavedResources /></PageContainer></AppShell>; }
