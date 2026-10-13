import { MockFrame } from "@/components/mock/MockFrame";
import { MockRevision } from "@/components/mock/StudentMocks";
import { PracticeRevision } from "@/components/practice/PracticeRevision";
export const dynamic = "force-dynamic";
export default function Page() { return <MockFrame currentPath="/practice"><PracticeRevision /><h2>Mock exam revision</h2><MockRevision /></MockFrame>; }
