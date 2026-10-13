import { describe, expect, it } from "vitest";
import { readPracticeRecovery, recoveryStorageKey } from "@/shared/practice-recovery";
const payload = { requestKey: "8664dc14-a97f-4e63-9747-0a76e597a077", questionId: "q", optionIds: ["a"] };
describe("tab-local practice submission recovery", () => {
  it("retains the identical UUID and answer for retry", () => { expect(readPracticeRecovery(JSON.stringify({ payload, savedAt: 1000 }), "q", 1001)).toEqual(payload); });
  it("separates different students and questions", () => {
    expect(recoveryStorageKey("one", "q")).not.toBe(recoveryStorageKey("two", "q")); expect(recoveryStorageKey("one", "q")).not.toBe(recoveryStorageKey("one", "r"));
  });
  it.each([null, "invalid", "x".repeat(4097), JSON.stringify({ payload, savedAt: 86401001 }), JSON.stringify({ payload, savedAt: -86400000 }), JSON.stringify({ payload: { ...payload, questionId: "r" }, savedAt: 1000 })])("rejects invalid, expired or mismatched recovery %s", raw => {
    expect(readPracticeRecovery(raw, "q", 1001)).toBeNull();
  });
  it("rejects protected-answer or role injection into recovered data", () => {
    expect(readPracticeRecovery(JSON.stringify({ savedAt: 1000, payload: { ...payload, correct: true } }), "q", 1001)).toBeNull();
  });
});
