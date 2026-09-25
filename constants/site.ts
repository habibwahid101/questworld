export const brand = {
  name: "Questra World",
  legalName: "Questra World",
  tagline: "A structured platform for allocated investment plans.",
} as const;

export const investmentPlans = [
  {
    id: "plan-100",
    amountUsd: 100,
    label: "$100",
    summary: "Entry allocation for members beginning with a smaller plan size.",
  },
  {
    id: "plan-1000",
    amountUsd: 1000,
    label: "$1,000",
    summary: "Standard allocation for members building a mid-size position.",
  },
  {
    id: "plan-10000",
    amountUsd: 10000,
    label: "$10,000",
    summary: "Larger allocation for members who prefer a higher plan size.",
  },
  {
    id: "plan-100000",
    amountUsd: 100000,
    label: "$100,000",
    summary: "Highest listed allocation currently prepared for display.",
  },
] as const;

export const referralRates = {
  directSponsorPercent: 3,
  secondGenerationPercent: 1,
} as const;

export const publicNav = [
  { href: "/", label: "Home" },
  { href: "/plans", label: "Plans" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/referrals", label: "Referrals" },
  { href: "/faq", label: "FAQ" },
] as const;

export const memberNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/investments", label: "Investments" },
  { href: "/profit-history", label: "Profit History" },
  { href: "/referrals/dashboard", label: "Referrals" },
  { href: "/wallet", label: "Wallet" },
  { href: "/withdraw", label: "Withdraw" },
  { href: "/transactions", label: "Transactions" },
  { href: "/profile", label: "Profile" },
] as const;

export const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/investments", label: "Investments" },
  { href: "/admin/deposits", label: "Deposits" },
  { href: "/admin/monthly-profit", label: "Monthly Profit" },
  { href: "/admin/referral-commissions", label: "Referral Commissions" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export const faqPreview = [
  {
    question: "What plan sizes are listed?",
    answer:
      "The current display set is $100, $1,000, $10,000, and $100,000. Product terms beyond plan size will be published when they are finalized.",
  },
  {
    question: "How does the referral structure work?",
    answer:
      "The listed structure is 3% for a Direct Sponsor and 1% for Second Generation. Commission processing is not active in this application foundation.",
  },
  {
    question: "Is account functionality live?",
    answer:
      "Authentication, wallets, deposits, withdrawals, and profit processing are intentionally not implemented in Step 01.",
  },
] as const;
