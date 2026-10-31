"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCurrentInvestment, InvestmentClientError, listCurrentInvestments } from "@/lib/investments/client";
import {
  formatUsdtAmount,
  investmentCatalog,
  totalReturnMinor,
  type InvestmentRecord,
  type InvestmentStatus,
  type PlanId,
} from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";
import styles from "./InvestmentsPanel.module.css";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  deposit_verified: "Deposit verified",
  rejected: "Rejected",
  active: "Active",
  completed: "Completed",
};

const MICRO = 1_000_000;
const LISTED_AMOUNTS = (Object.keys(investmentCatalog) as PlanId[]).map((planId) => ({
  planId,
  amount: investmentCatalog[planId].amountMinor / MICRO,
  name: investmentCatalog[planId].planName,
}));

export function InvestmentsPanel() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [inputAmount, setInputAmount] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void listCurrentInvestments()
      .then((records) => {
        if (active) {
          setInvestments(records);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setMessage(caught instanceof Error ? caught.message : "Could not load your investments.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const matched = useMemo(() => {
    const value = Number(inputAmount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return LISTED_AMOUNTS.find((entry) => entry.amount === value) ?? null;
  }, [inputAmount]);

  const activePlan = selectedPlan ?? matched?.planId ?? null;
  const activeAmountMinor = activePlan ? investmentCatalog[activePlan].amountMinor : null;
  const totalReturn = activeAmountMinor !== null ? totalReturnMinor(activeAmountMinor) : null;
  const monthlyPayment = totalReturn !== null ? Math.floor(totalReturn / 12) : null;

  function selectAmount(planId: PlanId) {
    const entry = LISTED_AMOUNTS.find((item) => item.planId === planId);
    if (!entry) {
      return;
    }
    setSelectedPlan(planId);
    setInputAmount(String(entry.amount));
    setMessage(null);
  }

  function onInput(value: string) {
    setInputAmount(value);
    setSelectedPlan(null);
    setMessage(null);
  }

  async function submit() {
    if (!activePlan || saving) {
      return;
    }
    setSaving(true);
    setMessage(null);
    const idempotencyKey = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = idempotencyKey;
    try {
      const record = await createCurrentInvestment(activePlan, idempotencyKey);
      pendingKey.current = null;
      router.push(`/investments/${encodeURIComponent(record.investmentId)}`);
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not record that investment.");
      setMessage(error.message);
      setSaving(false);
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
          Select or enter one of the listed amounts. Total return and duration appear immediately. This does not move money.
        </p>

        <div className={styles.amountRow}>
          {LISTED_AMOUNTS.map((entry) => (
            <button
              key={entry.planId}
              type="button"
              className={activePlan === entry.planId ? styles.amountButtonActive : styles.amountButton}
              onClick={() => selectAmount(entry.planId)}
            >
              {entry.amount.toLocaleString()} USDT
            </button>
          ))}
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Amount (USDT)</span>
          <input
            className={styles.input}
            inputMode="numeric"
            placeholder="100, 1,000, 10,000, or 100,000"
            value={inputAmount}
            onChange={(event) => onInput(event.target.value)}
          />
        </label>

        <div className={styles.result}>
          <div className={styles.resultRow}>
            <span>Total return</span>
            <strong>{totalReturn !== null ? formatUsdtAmount(totalReturn) : "—"}</strong>
          </div>
          <div className={styles.resultRow}>
            <span>Duration</span>
            <strong>12 months</strong>
          </div>
          <div className={styles.resultRow}>
            <span>Monthly payment</span>
            <strong>{monthlyPayment !== null ? formatUsdtAmount(monthlyPayment) : "—"}</strong>
          </div>
        </div>

        <p className={styles.note}>
          Note: Total return is double the investment, paid in 12 equal monthly payments. Not a payout until verified and active.
        </p>

        <Button type="button" disabled={!activePlan || saving} aria-busy={saving} onClick={() => void submit()}>
          {saving ? "Submitting…" : "Continue"}
        </Button>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        {!activePlan && inputAmount ? <p className={styles.hint}>Enter 100, 1,000, 10,000, or 100,000.</p> : null}
      </Card>

      {loading ? (
        <Card>
          <p>Loading investments…</p>
        </Card>
      ) : investments.length === 0 ? (
        <Card>
          <h2>No investments yet.</h2>
        </Card>
      ) : (
        investments.map((investment) => (
          <Card key={investment.investmentId}>
            <p className="eyebrow">{investment.planName}</p>
            <h2>{formatUsdtAmount(investment.amountMinor, investment.scale)}</h2>
            <p style={{ marginTop: 10 }}>Status: {statusLabel[investment.status]}</p>
            <p>Created {new Date(investment.createdAt).toLocaleString()}</p>
            {investment.status === "rejected" && investment.rejectionReason ? (
              <p>Rejection reason: {investment.rejectionReason}</p>
            ) : null}
            {investment.status === "awaiting_deposit" ? (
              <p style={{ marginTop: 12 }}>
                <Link href={`/investments/${encodeURIComponent(investment.investmentId)}`}>Continue to payment</Link>
              </p>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}