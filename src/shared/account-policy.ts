export const ACCOUNT_POLICY_VERSION = "2026-10-22-draft";
export const ACCOUNT_OPERATING_ENTITY = "TOP RANK AI PRIVATE LIMITED";
export const accountCountries = ["IN", "AE"] as const;
export const accountAgeBands = ["UNDER_13", "13_TO_17", "18_PLUS"] as const;
export type AccountCountry = typeof accountCountries[number];
export type AccountAgeBand = typeof accountAgeBands[number];

// Pilot safeguarding policy, subject to jurisdiction-specific legal approval.
export function needsGuardian(ageBand: AccountAgeBand) {
  return ageBand !== "18_PLUS";
}
