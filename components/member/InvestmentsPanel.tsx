"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCurrentInvestment, InvestmentClientError, listCurrentInvestments } from "@/lib/investments/client";
import { formatUsdtAmount, investmentCatalog, type InvestmentRecord, type InvestmentStatus, type PlanId } from "@/lib/investments/service";
import { PLAN_DESCRIPTIONS, PLAN_RATE_NOTE, planMonthlyRateLabel } from "@/lib/investments/plan-copy";
import { isMemberApiConfigured } from "@/lib/members/config";
import styles from "./InvestmentsPanel.module.css";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  deposit_verified: "Deposit verified",
  rejected: "Rejected",
  active: "Active",
};

export function InvestmentsPanel() {
  const router = useRouter();
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [savingPlan, setSavingPlan] = useState<PlanId | null>(null);
  const pendingKeys = useRef<Partial<Record<PlanId, string>>>({});

  const load = useCallback(async () => {
    setInvestments(await listCurrentInvestments());
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void load().catch((caught: unknown) => {
      if (!active) {
        return;
      }
      setMessage(caught instanceof Error ? caught.message : "Could not load your investments.");
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [load]);

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
      {loading ? (
        <Card>
          <p>Loading your investments…</p>
        </Card>
      ) : investments.length === 0 ? (
        <Card>
          <h2>No investments yet</h2>
          <p style={{ marginTop: 10 }}>When you choose a plan, it is recorded here as awaiting deposit.</p>
        </Card>
      ) : (
        investments.map((investment) => (
          <Card key={investment.investmentId}>
            <p className="eyebrow">{investment.planName}</p>
            <h2>{formatUsdtAmount(investment.amountMinor, investment.scale)}</h2>
            <p style={{ marginTop: 10 }}>Status: {statusLabel[investment.status]}</p>
            <p>Recorded {new Date(investment.createdAt).toLocaleString()}</p>
            {investment.status === "awaiting_deposit" ? (
              <Button href={`/investments/${encodeURIComponent(investment.investmentId)}`} variant="secondary" className={styles.paymentLink}>
                Continue to payment
              </Button>
            ) : null}
            {investment.depositReference ? <p style={{ marginTop: 10 }}>Reference {investment.depositReference}</p> : null}
            {investment.depositProofKey ? <p>Screenshot received</p> : null}
          </Card>
        ))
      )}
    </div>
  );
}
