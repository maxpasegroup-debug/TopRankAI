import { PAID_PLANS, planForCode } from "./plans";

/**
 * Checkout catalogue. Monthly only: every paid tier is one month per purchase.
 * The prices live in `plans.ts` so the pricing page and the server cannot drift.
 */
export const MOCK_PLANS = {
  RISER_MONTHLY: { label: PAID_PLANS[0].name, amountPaise: PAID_PLANS[0].pricePaise, months: 1 },
  SCHOLAR_MONTHLY: { label: PAID_PLANS[1].name, amountPaise: PAID_PLANS[1].pricePaise, months: 1 },
  TOPPER_MONTHLY: { label: PAID_PLANS[2].name, amountPaise: PAID_PLANS[2].pricePaise, months: 1 },
} as const;
export type MockPlan = keyof typeof MOCK_PLANS;

/** Human-readable label for a stored payment/subscription plan code, legacy included. */
export function planLabel(code: string | null | undefined) {
  if (code && code in MOCK_PLANS) return MOCK_PLANS[code as MockPlan].label;
  return planForCode(code).name;
}

export function renewalEnd(start: Date, months: number) {
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

export function renewalNotice(endsAt: Date | null, now = new Date()) {
  if (!endsAt) return null;
  const remaining = endsAt.getTime() - now.getTime();
  return remaining <= 0 ? "expired" : remaining <= 7 * 86400000 ? "renewal" : null;
}

export function formatPrice(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}
