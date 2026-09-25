import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { howItWorksSteps } from "@/constants/site";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "How It Works",
  "Create an account, choose a plan, send USDT, and track earnings after admin verification.",
  "/how-it-works",
);

export default function HowItWorksPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">How It Works</p>
          <h1>From registration to recorded activity</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            This page expands the public process. No payment, activation, or payout
            engine is connected in this version.
          </p>
        </div>
        <div className="grid-2">
          {howItWorksSteps.map((step) => (
            <Card key={step.number}>
              <p className="eyebrow">{step.number}</p>
              <h2>{step.title}</h2>
              <p style={{ marginTop: 10 }}>{step.body}</p>
            </Card>
          ))}
        </div>
        <div className="grid-2">
          <Card>
            <h2>Deposit path</h2>
            <p style={{ marginTop: 10 }}>
              USDT manual payment → submit transaction details → admin verification →
              investment activation.
            </p>
          </Card>
          <Card>
            <h2>Withdrawal path</h2>
            <p style={{ marginTop: 10 }}>
              Submit a withdrawal request → admin review → processing → paid. Public
              processing wording is 1–3 business days.
            </p>
          </Card>
        </div>
        <Button href="/register">Create Your Account</Button>
      </div>
    </section>
  );
}
