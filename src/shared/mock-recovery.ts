import { z } from "zod";
const id = z.string().min(1).max(100);
export const mockDraftSchema = z.object({ position: z.number().int().min(0).max(199), version: z.number().int().nonnegative(),
  answer: z.object({ optionIds: z.array(id).min(1).max(50).optional(), numerical: z.string().max(60).optional() }).strict()
    .refine(a => !(a.optionIds && a.numerical !== undefined)), flagged: z.boolean(), bookmarked: z.boolean() }).strict();
export type RecoverableMockDraft = z.infer<typeof mockDraftSchema>;
export function mockStorageKey(ownerId: string, attemptId: string) { return `toprank.mock.v1.${encodeURIComponent(ownerId)}.${encodeURIComponent(attemptId)}`; }
export function readMockDraft(raw: string | null, now = Date.now()): RecoverableMockDraft | null {
  if (!raw || raw.length > 8192) return null;
  try { const value = z.object({ savedAt: z.number().finite(), draft: mockDraftSchema }).strict().parse(JSON.parse(raw));
    return value.savedAt <= now && now - value.savedAt <= 86400000 ? value.draft : null;
  } catch { return null; }
}
export type ClockAnchor = { remaining: number; tick: number; wall: number };
export function mockSeconds(anchor: ClockAnchor, tick: number, wall: number) {
  const elapsed = Math.max(0, tick - anchor.tick, wall - anchor.wall);
  return Math.max(0, Math.ceil((anchor.remaining - elapsed) / 1000));
}
export function sameMockDraft(a: Pick<RecoverableMockDraft, "answer" | "flagged" | "bookmarked">, b: Pick<RecoverableMockDraft, "answer" | "flagged" | "bookmarked">) {
  const normalized = (answer: RecoverableMockDraft["answer"]) => answer.optionIds ? { optionIds: [...answer.optionIds].sort() } : answer;
  return JSON.stringify(normalized(a.answer)) === JSON.stringify(normalized(b.answer)) && a.flagged === b.flagged && a.bookmarked === b.bookmarked;
}
