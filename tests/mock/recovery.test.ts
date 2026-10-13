import { describe, expect, it } from "vitest";
import { mockSeconds, mockStorageKey, readMockDraft, sameMockDraft } from "@/shared/mock-recovery";
const draft = { position: 1, version: 3, answer: { numerical: "1." }, flagged: true, bookmarked: false };
describe("mock browser recovery and countdown helpers (not browser acceptance)", () => {
 it("recovers exactly the original answer and CAS version, including intermediate numeric input", () => { expect(readMockDraft(JSON.stringify({ savedAt: 100, draft }), 101)).toEqual(draft); });
 it("separates student and attempt storage", () => { expect(mockStorageKey("one", "a")).not.toBe(mockStorageKey("two", "a")); expect(mockStorageKey("one", "a")).not.toBe(mockStorageKey("one", "b")); });
 it.each([null, "bad", "x".repeat(8193), JSON.stringify({ savedAt: 102, draft }), JSON.stringify({ savedAt: -86400001, draft }), JSON.stringify({ savedAt: 100, draft: { ...draft, position: 200 } }), JSON.stringify({ savedAt: 100, draft: { ...draft, score: 4 } })])("rejects invalid or expired recovery", raw => { expect(readMockDraft(raw, 101)).toBeNull(); });
 it("recognizes lost acknowledgements despite reordered multiple-choice selections", () => { expect(sameMockDraft({ ...draft, answer: { optionIds: ["b", "a"] } }, { ...draft, answer: { optionIds: ["a", "b"] } })).toBe(true); });
 it("does not treat a different answer or flag as acknowledged", () => { expect(sameMockDraft(draft, { ...draft, flagged: false })).toBe(false); expect(sameMockDraft(draft, { ...draft, answer: { numerical: "2" } })).toBe(false); });
 it("counts down monotonically even if wall time moves backward", () => { expect(mockSeconds({ remaining: 60000, tick: 100, wall: 1000 }, 20100, 0)).toBe(40); });
 it("accounts for suspension when the monotonic clock stops", () => { expect(mockSeconds({ remaining: 60000, tick: 100, wall: 1000 }, 100, 31000)).toBe(30); });
 it("clamps expiry and forward clock jumps to zero (server reconciliation still required)", () => { expect(mockSeconds({ remaining: 60000, tick: 0, wall: 1000 }, 1000, 70000)).toBe(0); });
});
