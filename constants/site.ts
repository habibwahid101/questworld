import type { FaqItem, InvestmentPlan, NavItem } from "@/types";

export const brand = {
  name: "Questra World",
  legalName: "Questra World",
  tagline: "Build your investment journey with clear plans and recorded activity.",
} as const;

/**
 * Display-only monthly rate for public marketing examples in Step 02.
 * Not a locked product engine value. Future backend will supply the applicable rate.
 */
export const displayMonthlyRatePercent = 8;

export const investmentPlans: readonly InvestmentPlan[] = [
  {
    id: "starter",
    name: "Starter",
    amountUsd: 100,
    label: "$100",
    ctaLabel: "Invest $100",
    summary: "Entry plan for members starting with the minimum listed allocation.",
  },
  {
    id: "growth",
    name: "Growth",
    amountUsd: 1000,
    label: "$1,000",
    ctaLabel: "Invest $1,000",
    summary: "Most commonly reviewed allocation for a mid-size position.",
    featured: true,
  },
  {
    id: "professional",
    name: "Professional",
    amountUsd: 10000,
    label: "$10,000",
    ctaLabel: "Invest $10,000",
    summary: "Larger allocation for members who prefer a higher plan size.",
  },
  {
    id: "premium",
    name: "Premium",
    amountUsd: 100000,
    label: "$100,000",
    ctaLabel: "Invest $100,000",
    summary: "Highest listed allocation currently shown on the public site.",
  },
];

export const referralRates = {
  directSponsorPercent: 3,
  secondGenerationPercent: 1,
} as const;

export const publicNav: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/plans", label: "Investment Plans" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/referrals", label: "Referral Program" },
  { href: "/faq", label: "FAQ" },
];

export const footerExploreNav: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/plans", label: "Plans" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/referrals", label: "Referral Program" },
  { href: "/faq", label: "FAQ" },
];

export const footerAccountNav: readonly NavItem[] = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/contact", label: "Contact / Support" },
];

export const memberPhoneNav: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/investments", label: "Investments" },
  { href: "/referrals/dashboard", label: "Referrals" },
  { href: "/withdraw", label: "Withdraw" },
];

export const memberNav: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/investments", label: "Investments" },
  { href: "/profit-history", label: "Profit History" },
  { href: "/referrals/dashboard", label: "Referrals" },
  { href: "/wallet", label: "Wallet" },
  { href: "/withdraw", label: "Withdraw" },
  { href: "/transactions", label: "Transactions" },
  { href: "/profile", label: "Profile" },
];

export const adminNav: readonly NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/investments", label: "Investments" },
  { href: "/admin/deposits", label: "Deposits" },
  { href: "/admin/monthly-profit", label: "Monthly Profit" },
  { href: "/admin/referral-commissions", label: "Referral Commissions" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/settings", label: "Settings" },
];

export const howItWorksSteps = [
  {
    number: "01",
    title: "Create Account",
    body: "Register and access your Questra World dashboard.",
  },
  {
    number: "02",
    title: "Choose a Plan",
    body: "Select one of the available investment packages.",
  },
  {
    number: "03",
    title: "Complete Payment",
    body: "Send USDT and submit your transaction information.",
  },
  {
    number: "04",
    title: "Track Your Earnings",
    body: "Monitor investment earnings, referral earnings and withdrawals from your dashboard.",
  },
] as const;

export const whyItems = [
  {
    title: "Simple Investment Plans",
    body: "Four listed allocations from $100 to $100,000, presented without promotional clutter.",
  },
  {
    title: "Clear Transaction History",
    body: "The member area is structured so deposits, earnings, and withdrawals can be reviewed as records.",
  },
  {
    title: "Monthly Earnings Tracking",
    body: "Estimated monthly figures are shown using the applicable rate for the investment period.",
  },
  {
    title: "Referral Earnings",
    body: "Two listed levels only: 3% Direct Sponsor and 1% Second Generation.",
  },
  {
    title: "USDT Payments",
    body: "Investments are prepared for manual USDT payment, followed by admin verification.",
  },
  {
    title: "Easy Withdrawal Requests",
    body: "Members submit a request for admin review. Public processing wording is 1–3 business days.",
  },
] as const;

export const faqItems: readonly FaqItem[] = [
  {
    question: "What is the minimum investment?",
    answer:
      "The lowest listed plan is Starter at $100.",
  },
  {
    question: "What investment plans are available?",
    answer:
      "The listed plans are Starter ($100), Growth ($1,000), Professional ($10,000), and Premium ($100,000).",
  },
  {
    question: "How is monthly profit calculated?",
    answer:
      "Estimated monthly earnings are shown as the investment amount multiplied by the applicable monthly rate for that period. The rate shown on this website is display content for the current public pages and will be supplied by the backend in a later step.",
  },
  {
    question: "When does my monthly investment cycle begin?",
    answer:
      "The public process is: send USDT, submit transaction details, then wait for admin verification. The investment is treated as active after verification. A more detailed cycle calendar is not published in this version.",
  },
  {
    question: "How does the referral program work?",
    answer:
      "The structure is A → B → C. If C has an active investment, B receives 3% Direct Sponsor and A receives 1% Second Generation. There is no Generation 3 or later commission. Commissions are generated monthly while the source investment remains active.",
  },
  {
    question: "Do I need to invest to earn referral commission?",
    answer:
      "No. A sponsor does not need an active investment of their own to remain eligible for referral commission.",
  },
  {
    question: "How do I make an investment payment?",
    answer:
      "Payment is a manual USDT transfer. After sending funds, submit the transaction details for admin verification. The investment is activated after that review. No automated payment processing is live in this version.",
  },
  {
    question: "How do withdrawals work?",
    answer:
      "Submit a withdrawal request from the member area. An administrator reviews the request, then it is processed and paid. Public processing wording is 1–3 business days.",
  },
  {
    question: "Can I have multiple investments?",
    answer:
      "The member area is structured around an investments list so more than one plan record can be shown. Activation still follows payment submission and admin verification for each record.",
  },
  {
    question: "Can I close an investment?",
    answer:
      "Early-close or cancellation terms are not published in this version. Public pages describe activation, monthly tracking, and withdrawal requests only.",
  },
];
