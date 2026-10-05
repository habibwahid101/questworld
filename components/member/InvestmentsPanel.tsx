"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCurrentInvestment, InvestmentClientError, listCurrentInvestments, submitCurrentDeposit } from "@/lib/investments/client";
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
  const [savingDepositId, setSavingDepositId] = useState<string | null>(null);
  const [references, setReferences] = useState<Record<string, string>>({});
  const pendingKeys = useRef<Partial<Record<PlanId, string>>>({});
  const depositKeys = useRef<Record<string, string>>({});

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
    if (savingPlan || savingDepositId) {
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

  async function submitReference(investmentId: string) {
    if (savingPlan || savingDepositId) {
      return;
    }
    const reference = references[investmentId]?.trim() ?? "";
    setSavingDepositId(investmentId);
    setMessage(null);
    const idempotencyKey = depositKeys.current[investmentId] ?? crypto.randomUUID();
    depositKeys.current[investmentId] = idempotencyKey;
    try {
      await submitCurrentDeposit(investmentId, reference, idempotencyKey);
      delete depositKeys.current[investmentId];
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that deposit reference.");
      setMessage(error.message);
    } finally {
      setSavingDepositId(null);
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
              disabled={savingPlan !== null || savingDepositId !== null}
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
            {investment.status === "awaiting_deposit" ? (
              <form
                style={{ marginTop: 16 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitReference(investment.investmentId);
                }}
              >
                <label htmlFor={`deposit-${investment.investmentId}`}>Deposit reference</label>
                <input
                  id={`deposit-${investment.investmentId}`}
                  value={references[investment.investmentId] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setReferences((current) => ({ ...current, [investment.investmentId]: value }));
                  }}
                  autoComplete="off"
                  style={{ display: "block", width: "100%", marginTop: 8 }}
                />
                <Button type="submit" disabled={savingPlan !== null || savingDepositId !== null} style={{ marginTop: 12 }}>
                  {savingDepositId === investment.investmentId ? "Submitting…" : "Submit reference"}
                </Button>
              </form>
            ) : null}
            {investment.depositReference ? <p style={{ marginTop: 10 }}>Reference {investment.depositReference}</p> : null}
          </Card>
        ))
      )}
    </div>
  );
}
