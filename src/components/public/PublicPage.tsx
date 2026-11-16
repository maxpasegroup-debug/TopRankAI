import { Marketing } from "@/components/experience/Marketing";
export function PublicPage({ page }: { page: "how" | "exams" | "progress" | "about" }) { return <Marketing page={page} />; }
