"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCurrentInvestment, InvestmentClientError } from "@/lib/investments/client";
import { formatUsdtAmount, investmentCatalog, type PlanId } from "@/lib/investments/service";
import { PLAN_DESCRIPTIONS, PLAN_RATE_NOTE, planMonthlyRateLabel } from "@/lib/investments/plan-copy";
import { isMemberApiConfigured } from "@/lib/members/config";
import styles from "./InvestmentsPanel.module.css";

export function InvestmentsPanel() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState<PlanId | null>(null);
  const pendingKeys = useRef<Partial<Record<PlanId, string>>>({});

  async function choosePlan(planId: PlanId) {
    if (savingPlan) {
      return;
    }
    setSavingPlan(planId);
    setMessage(null);
    const idempotencyKey = pendingKeys.current[planId] ?? crypto.randomUUID();
    pendingKeys.current[planId] = idempotencyKey;
    try {
      const record = await createCurrentInvestment(planId, idempotencyKey);
      delete pendingKeys.current[planId];
      router.push(`/investments/${encodeURIComponent(record.investmentId)}`);
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not record that investment.");
      setMessage(error.message);
      setSavingPlan(null);
    }
  }

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Investments</h1>
        <p className="lead">Authentication is connected. Investment storage is not configured for this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Investments</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Choose a listed plan to record an investment. This does not move money.
        </p>
        <div className={styles.plans}>
          {(Object.keys(investmentCatalog) as PlanId[]).map((planId) => {
            const plan = investmentCatalog[planId];
            return (
              <Card key={planId} className={styles.plan}>
                <p className="eyebrow">{plan.planName}</p>
                <h2>{formatUsdtAmount(plan.amountMinor)}</h2>
                <p className={styles.description}>{PLAN_DESCRIPTIONS[planId]}</p>
                <p className={styles.rate}>{planMonthlyRateLabel()}</p>
                <p className={styles.note}>{PLAN_RATE_NOTE}</p>
                <Button
                  type="button"
                  disabled={savingPlan !== null}
                  onClick={() => void choosePlan(planId)}
                >
                  {savingPlan === planId ? "Recording…" : "Choose"}
                </Button>
              </Card>
            );
          })}
        </div>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
    </div>
  );
}
