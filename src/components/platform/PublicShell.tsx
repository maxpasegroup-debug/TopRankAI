import { getCurrentUser } from "@/server/auth/session";
import { RevealProvider } from "./RevealProvider";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export async function getViewer() {
  try {
    const user = await getCurrentUser(true);
    return user ? { name: user.name, role: user.role as string } : null;
  } catch {
    return null;
  }
}

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <div className="tp-site">
      <SiteHeader user={viewer} />
      <main className="tp-site-main" id="main">
        {children}
      </main>
      <SiteFooter />
      <RevealProvider />
    </div>
  );
}
