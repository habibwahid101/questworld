export type NavItem = {
  href: string;
  label: string;
};

export type InvestmentPlan = {
  id: string;
  amountUsd: number;
  label: string;
  summary: string;
};

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type PlaceholderNotice = {
  title: string;
  description: string;
};
