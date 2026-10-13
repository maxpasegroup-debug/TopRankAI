import { z } from "zod";
const payload = z.object({ requestKey: z.uuid(), questionId: z.string().min(1).max(100),
  optionIds: z.array(z.string().min(1).max(100)).min(1).max(20).optional(), numerical: z.string().min(1).max(60).optional() }).strict()
  .refine(v => (v.optionIds !== undefined) !== (v.numerical !== undefined));
export type PracticePayload = z.infer<typeof payload>;
export function recoveryStorageKey(ownerId: string, questionId: string) { return `toprank.practice.v1.${encodeURIComponent(ownerId)}.${encodeURIComponent(questionId)}`; }
export function readPracticeRecovery(raw: string | null, questionId: string, now = Date.now()): PracticePayload | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const result = z.object({ savedAt: z.number().finite(), payload }).strict().parse(JSON.parse(raw));
    if (result.payload.questionId !== questionId || result.savedAt > now || now - result.savedAt > 86400000) return null;
    return result.payload;
  } catch { return null; }
}
