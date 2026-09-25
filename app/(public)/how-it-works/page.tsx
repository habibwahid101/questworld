import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "How it works",
  description: "The intended Questra World member path from registration to records.",
};

const steps = [
  {
    title: "Register",
    body: "Create an account with name, email, password, optional referral code, and terms acceptance.",
  },
  {
    title: "Review plans",
    body: "Compare the listed $100, $1,000, $10,000, and $100,000 allocation sizes.",
  },
  {
    title: "Hold a plan",
    body: "Investment allocation and deposit confirmation will be added in a later approved step.",
  },
  {
    title: "Review activity",
    body: "The member shell is prepared for profit history, referrals, wallet, withdrawals, and transactions.",
  },
];

export default function HowItWorksPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">How it works</p>
          <h1>From account creation to recorded activity</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            This page describes the intended product path. No investment, profit, or
            payout engine is active yet.
          </p>
        </div>
        <div className="grid-2">
          {steps.map((step) => (
            <Card key={step.title}>
              <h2>{step.title}</h2>
              <p style={{ marginTop: 10 }}>{step.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
