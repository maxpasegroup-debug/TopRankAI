import { redirect } from "next/navigation";

export const metadata = { title: "Administrator sign in | TopRank AI" };

export default function LegacyAdminLoginPage() {
  redirect("/login/admin");
}
