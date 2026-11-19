import type { IconName } from "@/components/platform/Icon";

/** Scholar-tier defaults. Per-plan limits live in `shared/plans.ts`. */
export const PRO_FREEZES_PER_MONTH = 2;
export const PRO_CUSTOM_TESTS_PER_DAY = 5;
export const CUSTOM_TEST_MIN_QUESTIONS = 5;
export const CUSTOM_TEST_MAX_QUESTIONS = 50;

export type ProFeature = {
  icon: IconName;
  title: string;
  body: string;
};

/**
 * What every paid tier adds over Aspirant. Kept in one place so the pricing
 * page and the upgrade prompts always describe the same bundle.
 */
export const PRO_FEATURES: ProFeature[] = [
  {
    icon: "layers",
    title: "More papers every day",
    body: "Riser runs six papers a day, Scholar and Topper run eight — every exam in your plan, same official pattern.",
  },
  {
    icon: "target",
    title: "Custom tests",
    body: "Build your own paper by subject, topic and difficulty, then set the clock. Two a day on Riser, more on higher tiers.",
  },
  {
    icon: "chart",
    title: "Advanced analytics",
    body: "See negative-mark loss, time per question and subject momentum alongside the accuracy trend you already track.",
  },
  {
    icon: "calendar",
    title: "Report cards",
    body: "A printable report on your submitted papers. Scholar and Topper add a weekly card with the previous week beside it.",
  },
  {
    icon: "book",
    title: "Formula and mistake sheets",
    body: "One printable sheet with the exam's published formulas and every question you answered wrong, with the explanation.",
  },
  {
    icon: "flame",
    title: "Streak freezes",
    body: "Protect a missed day without inventing a paper. One a month on Riser, two on Scholar, four on Topper.",
  },
];

export const PRO_CARD_POINTS = [
  "Up to 8 papers a day for every exam",
  "Custom tests, report cards and revision sheets",
  "Advanced analytics and streak freezes",
  "Everything already included in Aspirant",
];

export const FREE_CARD_POINTS = [
  "Daily papers set by your preparation level",
  "Official-pattern mocks and practice sets",
  "Learning centre, planner, revision and analytics",
  "Deterministic scoring and full paper history",
];
