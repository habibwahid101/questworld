import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { investmentPlans, yearlyReturnCopy } from "@/constants/site";
import { formatUsd } from "@/utils/format";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Investment Plans",
  "Review the listed Questra World allocations from $100 to $100,000.",
  "/plans",
);

export default function PlansPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Investment Plans</p>
          <h1>Choose a listed allocation</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            Each plan is paid by manual USDT transfer and activated after admin
            verification. {yearlyReturnCopy}
          </p>
        </div>
        <div className="grid-2">
          {investmentPlans.map((plan) => {
            return (
              <Card key={plan.id}>
                <div className="cluster">
                  <h2>{plan.name}</h2>
                  {plan.featured ? <Badge tone="info">Popular</Badge> : null}
                </div>
                <p style={{ marginTop: 8, fontSize: "2rem", fontWeight: 700, color: "var(--color-text)" }}>
                  {formatUsd(plan.amountUsd)}
                </p>
                <p style={{ marginTop: 10 }}>{plan.summary}</p>
                <p style={{ marginTop: 16 }}>{yearlyReturnCopy}</p>
                <ul className="stack" style={{ marginTop: 16, paddingLeft: 18 }}>
                  <li>Referral eligible</li>
                  <li>USDT payment</li>
                </ul>
                <div style={{ marginTop: 18 }}>
                  <Button href="/register">{plan.ctaLabel}</Button>
                </div>
              </Card>
            );
          })}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Amount</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              {investmentPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.name}</td>
                  <td>{formatUsd(plan.amountUsd)}</td>
                  <td>{yearlyReturnCopy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
