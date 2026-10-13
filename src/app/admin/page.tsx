import { requireRole } from "@/server/auth/session";
import { OperationsWorkspace } from "@/components/journey/OperationsWorkspace";
import { PageContainer } from "@/components/ui/PageContainer";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  await requireRole(["PLATFORM_ADMIN"]);
  return <PageContainer><nav className="mock-links"><Link href="/admin/operations">Launch operations</Link><Link href="/admin/mock-exams">Mock exam blueprints</Link><Link href="/admin/competitions">Competitions & awards</Link><Link href="/admin/commerce">Commerce</Link><Link href="/admin/portals">Institutions & consent</Link></nav><OperationsWorkspace /></PageContainer>;
}
