import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { investmentPlans } from "@/constants/site";
import { formatUsd } from "@/utils/format";

export const metadata: Metadata = {
  title: "Plans",
  description: "Listed Questra World allocation sizes.",
};

export default function PlansPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Plans</p>
          <h1>Listed allocation sizes</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            Plan cards describe size only. Profit rates, lock periods, and processing
            rules are not defined in this foundation.
          </p>
        </div>
        <div className="grid-2">
          {investmentPlans.map((plan) => (
            <Card key={plan.id}>
              <h2>{formatUsd(plan.amountUsd)}</h2>
              <p style={{ marginTop: 10 }}>{plan.summary}</p>
              <div style={{ marginTop: 18 }}>
                <Button href="/register" variant="ghost">
                  Continue to register
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
