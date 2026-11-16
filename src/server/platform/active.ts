import { cookies } from "next/headers";
import { ACTIVE_EXAM_COOKIE } from "./cookies";
import { getSelectedExam, type CandidateExam } from "./candidate";

export async function getActiveExam(userId: string): Promise<CandidateExam | null> {
  const store = await cookies();
  const code = store.get(ACTIVE_EXAM_COOKIE)?.value ?? null;
  return getSelectedExam(userId, code);
}
