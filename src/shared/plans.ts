import type { IconName } from "@/components/platform/Icon";

/**
 * The plan catalogue. One source of truth for the pricing page, the checkout,
 * the badges and every server-side limit. Prices are monthly only.
 */
export const PLAN_IDS = ["FREE", "RISER", "SCHOLAR", "TOPPER"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlanId = Exclude<PlanId, "FREE">;

export const PAID_PLAN_CODES = ["RISER_MONTHLY", "SCHOLAR_MONTHLY", "TOPPER_MONTHLY"] as const;
export type PlanCode = (typeof PAID_PLAN_CODES)[number];

/** Older checkouts used these codes; they keep working and map to Scholar. */
export const LEGACY_PLAN_CODES = ["MOCK_MONTHLY", "MOCK_YEARLY"] as const;

export type AiAllowance = {
  /** SIA answers per day. */
  siaPerDay: number;
  /** AI-written topic notes per month. */
  notesPerMonth: number;
  /** Post-paper AI feedback reports per month. */
  feedbackPerMonth: number;
  /** AI study-plan rebuilds per month. */
  plansPerMonth: number;
  /** Step-by-step solutions on wrong answers per month. */
  solutionsPerMonth: number;
  /** Typed answer evaluations per month. */
  typedEvaluationsPerMonth: number;
  /** Photo or handwriting evaluations per month. */
  photoEvaluationsPerMonth: number;
  /** Generated diagrams and posters per month. */
  imagesPerMonth: number;
  /** Generated flashcard sets per month. */
  flashcardsPerMonth: number;
  /** Voice viva practice minutes per month. */
  voiceMinutesPerMonth: number;
};

export type PlanLimits = {
  /** Hard cap on daily papers per exam. */
  dailyPapers: number;
  customTestsPerDay: number;
  freezesPerMonth: number;
  ai: AiAllowance;
};

export type Plan = {
  id: PlanId;
  code: PlanCode | null;
  name: string;
  tagline: string;
  pricePaise: number;
  icon: IconName;
  highlight?: boolean;
  limits: PlanLimits;
  points: string[];
};

const free: Plan = {
  id: "FREE",
  code: null,
  name: "Aspirant",
  tagline: "The full daily loop, free forever.",
  pricePaise: 0,
  icon: "book",
  limits: {
    dailyPapers: 4,
    customTestsPerDay: 0,
    freezesPerMonth: 0,
    ai: {
      siaPerDay: 10,
      notesPerMonth: 5,
      feedbackPerMonth: 4,
      plansPerMonth: 1,
      solutionsPerMonth: 10,
      typedEvaluationsPerMonth: 0,
      photoEvaluationsPerMonth: 0,
      imagesPerMonth: 0,
      flashcardsPerMonth: 0,
      voiceMinutesPerMonth: 0,
    },
  },
  points: [
    "1–4 daily papers, set by your level",
    "Official-pattern mocks and practice sets",
    "Learning centre, planner and revision queue",
    "Core analytics and full paper history",
    "Deterministic scoring on every paper",
  ],
};

const riser: Plan = {
  id: "RISER",
  code: "RISER_MONTHLY",
  name: "Riser",
  tagline: "More papers and the first layer of AI.",
  pricePaise: 9900,
  icon: "pulse",
  limits: {
    dailyPapers: 6,
    customTestsPerDay: 2,
    freezesPerMonth: 1,
    ai: {
      siaPerDay: 40,
      notesPerMonth: 25,
      feedbackPerMonth: 15,
      plansPerMonth: 4,
      solutionsPerMonth: 50,
      typedEvaluationsPerMonth: 10,
      photoEvaluationsPerMonth: 0,
      imagesPerMonth: 5,
      flashcardsPerMonth: 5,
      voiceMinutesPerMonth: 0,
    },
  },
  points: [
    "Up to 6 papers a day for every exam",
    "2 custom tests a day",
    "Advanced analytics and printable report card",
    "Revision sheet and 1 streak freeze a month",
    "40 SIA doubts a day",
  ],
};

const scholar: Plan = {
  id: "SCHOLAR",
  code: "SCHOLAR_MONTHLY",
  name: "Scholar",
  tagline: "The full toolkit for a serious attempt.",
  pricePaise: 29900,
  icon: "cap",
  highlight: true,
  limits: {
    dailyPapers: 8,
    customTestsPerDay: 5,
    freezesPerMonth: 2,
    ai: {
      siaPerDay: 120,
      notesPerMonth: 75,
      feedbackPerMonth: 40,
      plansPerMonth: 12,
      solutionsPerMonth: 150,
      typedEvaluationsPerMonth: 40,
      photoEvaluationsPerMonth: 20,
      imagesPerMonth: 25,
      flashcardsPerMonth: 20,
      voiceMinutesPerMonth: 30,
    },
  },
  points: [
    "Up to 8 papers a day for every exam",
    "5 custom tests a day",
    "Weekly report card with last week beside it",
    "2 streak freezes a month",
    "120 SIA doubts a day and 25 images",
  ],
};

const topper: Plan = {
  id: "TOPPER",
  code: "TOPPER_MONTHLY",
  name: "Topper",
  tagline: "Maximum practice and AI for the final stretch.",
  pricePaise: 59900,
  icon: "crown",
  limits: {
    dailyPapers: 8,
    customTestsPerDay: 10,
    freezesPerMonth: 4,
    ai: {
      siaPerDay: 300,
      notesPerMonth: 200,
      feedbackPerMonth: 100,
      plansPerMonth: 30,
      solutionsPerMonth: 400,
      typedEvaluationsPerMonth: 120,
      photoEvaluationsPerMonth: 80,
      imagesPerMonth: 80,
      flashcardsPerMonth: 60,
      voiceMinutesPerMonth: 120,
    },
  },
  points: [
    "8 papers a day with priority generation",
    "10 custom tests a day",
    "4 streak freezes a month",
    "Weekly report card with a 4-week trend",
    "300 SIA doubts a day and 80 images",
  ],
};

export const PLANS: Record<PlanId, Plan> = { FREE: free, RISER: riser, SCHOLAR: scholar, TOPPER: topper };
export const PLAN_LIST: Plan[] = [free, riser, scholar, topper];
export const PAID_PLANS: Plan[] = [riser, scholar, topper];

export function planRank(plan: Plan | PlanId) {
  return PLAN_IDS.indexOf(typeof plan === "string" ? plan : plan.id);
}

export function isPlanCode(value: string): value is PlanCode {
  return (PAID_PLAN_CODES as readonly string[]).includes(value);
}

/** Unknown and legacy codes fall back to Scholar so existing Pro access never shrinks. */
export function planForCode(code: string | null | undefined): Plan {
  if (!code) return free;
  if (isPlanCode(code)) return PLANS[code.replace("_MONTHLY", "") as PaidPlanId];
  if ((LEGACY_PLAN_CODES as readonly string[]).includes(code)) return scholar;
  return free;
}

export function planForSubscription(
  subscription: { plan: string; status: string; endsAt: Date | null } | null | undefined,
  now = new Date(),
): Plan {
  if (!subscription) return free;
  const known = isPlanCode(subscription.plan) || (LEGACY_PLAN_CODES as readonly string[]).includes(subscription.plan);
  if (!known || subscription.status !== "ACTIVE" || !subscription.endsAt || subscription.endsAt <= now) return free;
  return planForCode(subscription.plan);
}

export function isPaid(plan: Plan | PlanId) {
  return (typeof plan === "string" ? plan : plan.id) !== "FREE";
}

export function planDailyPaperCap(plan: Plan | PlanId) {
  return (typeof plan === "string" ? PLANS[plan] : plan).limits.dailyPapers;
}

/** Rows rendered in the AI allowance table on the pricing page. */
export const AI_ALLOWANCE_ROWS: { key: keyof AiAllowance; label: string; unit: string }[] = [
  { key: "siaPerDay", label: "SIA doubts", unit: "day" },
  { key: "notesPerMonth", label: "AI topic notes", unit: "month" },
  { key: "feedbackPerMonth", label: "AI exam feedback", unit: "month" },
  { key: "plansPerMonth", label: "AI study plans", unit: "month" },
  { key: "solutionsPerMonth", label: "Step-by-step solutions", unit: "month" },
  { key: "typedEvaluationsPerMonth", label: "Typed answer checks", unit: "month" },
  { key: "photoEvaluationsPerMonth", label: "Photo answer checks", unit: "month" },
  { key: "imagesPerMonth", label: "Image generation", unit: "month" },
  { key: "flashcardsPerMonth", label: "Flashcard sets", unit: "month" },
  { key: "voiceMinutesPerMonth", label: "Voice viva minutes", unit: "month" },
];
