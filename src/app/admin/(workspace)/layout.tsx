import { AdminShell } from "@/components/platform/admin/AdminShell";

export const dynamic = "force-dynamic";

export default function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
