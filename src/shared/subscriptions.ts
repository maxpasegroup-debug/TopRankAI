export const MOCK_PLANS = {
  MOCK_MONTHLY: { label: "Monthly", amountPaise: 29900, months: 1 },
  MOCK_YEARLY: { label: "Yearly", amountPaise: 299900, months: 12 },
} as const;
export type MockPlan = keyof typeof MOCK_PLANS;

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
