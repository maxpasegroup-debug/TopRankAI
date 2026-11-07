import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { PrivacyRequests } from "@/components/account/PrivacyRequests";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getCurrentUser(true);
  if (!user) redirect("/login");
  if (user.role !== "STUDENT" && user.role !== "PARENT") redirect("/workspace");
  return <PrivacyRequests guardian={user.role === "PARENT"} />;
}
