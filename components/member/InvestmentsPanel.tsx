"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCurrentInvestment, InvestmentClientError, listCurrentInvestments } from "@/lib/investments/client";
import { formatUsdtAmount, type InvestmentRecord, type InvestmentStatus, type PlanId } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  active: "Active",
};

const plans: readonly { id: PlanId; label: string }[] = [
  { id: "starter", label: "Starter" },
  { id: "growth", label: "Growth" },
  { id: "professional", label: "Professional" },
  { id: "premium", label: "Premium" },
];

export function InvestmentsPanel() {
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [savingPlan, setSavingPlan] = useState<PlanId | null>(null);
  const pendingKeys = useRef<Partial<Record<PlanId, string>>>({});

  const load = useCallback(async () => {
    const records = await listCurrentInvestments();
    setInvestments(records);
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
      await createCurrentInvestment(planId, idempotencyKey);
      delete pendingKeys.current[planId];
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not record that investment.");
      setMessage(error.message);
    } finally {
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
          Choose a listed plan to record an investment. Payment, deposit verification, and activation come in a later step. This does not move money.
        </p>
        <div className="grid-2" style={{ marginTop: 20 }}>
          {plans.map((plan) => (
            <Button
              key={plan.id}
              variant="secondary"
              disabled={savingPlan !== null}
              onClick={() => void choosePlan(plan.id)}
            >
              {savingPlan === plan.id ? "Recording…" : plan.label}
            </Button>
          ))}
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
          </Card>
        ))
      )}
    </div>
  );
}
