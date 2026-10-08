import { MONTHLY_PROFIT_RATE_BPS, type PlanId } from "./service.ts";

export const PLAN_DESCRIPTIONS: Record<PlanId, string> = {
  starter: "Entry plan for a first investment.",
  growth: "A larger plan with the same monthly rate.",
  professional: "A higher plan with the same monthly rate.",
  premium: "The largest listed plan with the same monthly rate.",
};

export const PLAN_RATE_NOTE = "Not a payout.";

export function planMonthlyRateLabel(): string {
  return `${MONTHLY_PROFIT_RATE_BPS / 100}% monthly`;
}
