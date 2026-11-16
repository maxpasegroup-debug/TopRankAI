import { AdminFrame } from "./AdminFrame";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/session";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["PLATFORM_ADMIN"]);
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true, name: true, email: true } });

  return (
    <AdminFrame user={{ name: profile?.name ?? user.name, email: profile?.email ?? user.email, avatarUrl: profile?.avatarUrl ?? null }}>
      {children}
    </AdminFrame>
  );
}
