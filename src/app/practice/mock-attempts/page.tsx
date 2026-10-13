import { redirect } from "next/navigation";
import { MockFrame } from "@/components/mock/MockFrame";
import { MockWorkspace } from "@/components/mock/StudentMocks";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ attemptId?: string }> }) {
 const { attemptId } = await searchParams; if (!attemptId) redirect("/practice/mock-tests");
 return <MockFrame currentPath="/practice"><MockWorkspace key={attemptId} attemptId={attemptId} /></MockFrame>;
}
