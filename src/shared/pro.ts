import type { IconName } from "@/components/platform/Icon";

/** Pro allowances. These are product limits, enforced on the server. */
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
 * Everything Pro adds. Kept in one place so the pricing page, the upgrade
 * prompts and the checkout always describe the same bundle.
 */
export const PRO_FEATURES: ProFeature[] = [
  {
    icon: "layers",
    title: "Up to 8 papers a day",
    body: "Every exam in your plan can run up to eight full official-pattern papers instead of your level's one to four.",
  },
  {
    icon: "target",
    title: "Custom tests",
    body: "Build your own paper by subject and difficulty, choose the question count and set the clock. Up to five a day.",
  },
  {
    icon: "chart",
    title: "Advanced analytics",
    body: "See negative-mark loss, time per question and subject momentum alongside the accuracy trend you already track.",
  },
  {
    icon: "calendar",
    title: "Weekly report card",
    body: "A seven-day report with the previous week beside it, ready to print or save as a PDF.",
  },
  {
    icon: "book",
    title: "Formula and mistake sheets",
    body: "One printable sheet with the exam's published formulas and every question you answered wrong, with the explanation.",
  },
  {
    icon: "flame",
    title: "Two streak freezes a month",
    body: "Protect one missed day without inventing a paper. The streak keeps its count and moves forward.",
  },
];

export const PRO_CARD_POINTS = [
  "Up to 8 papers a day for every exam",
  "Custom tests, weekly report card and revision sheets",
  "Advanced analytics and 2 streak freezes a month",
  "Everything already included in Free",
];

export const FREE_CARD_POINTS = [
  "Daily papers set by your preparation level",
  "Official-pattern mocks and practice sets",
  "Learning centre, planner, revision and analytics",
  "Deterministic scoring and full paper history",
];
