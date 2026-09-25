export type NavItem = {
  href: string;
  label: string;
};

export type InvestmentPlan = {
  id: string;
  name: string;
  amountUsd: number;
  label: string;
  ctaLabel: string;
  summary: string;
  featured?: boolean;
};

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type FaqItem = {
  question: string;
  answer: string;
};
