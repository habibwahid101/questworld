"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listCurrentProfits, listCurrentWithdrawals } from "@/lib/investments/client";
import {
  INVESTMENT_CURRENCY,
  INVESTMENT_SCALE,
  formatUsdtAmount,
} from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

type Figures = {
  profit: number | null;
  available: number | null;
  pendingCount: number | null;
  pendingTotal: number | null;
};

export function WalletPanel() {
  const [figures, setFigures] = useState<Figures | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void Promise.allSettled([listCurrentProfits(), listCurrentWithdrawals()]).then((results) => {
      if (!active) {
        return;
      }
      const [profits, withdrawals] = results;
      const errors = results.flatMap((result) => (result.status === "rejected" ? [readError(result.reason)] : []));
      setMessage(errors[0] ?? null);
      const pending = withdrawals.status === "fulfilled" ? withdrawals.value.withdrawals.filter((request) => request.status === "pending_review") : null;
      setFigures({
        profit: profits.status === "fulfilled" ? totalMinor(profits.value, (entry) => entry.profitMinor) : null,
        available: withdrawals.status === "fulfilled" ? withdrawals.value.availableMinor : null,
        pendingCount: pending ? pending.length : null,
        pendingTotal: pending ? totalMinor(pending, (request) => request.amountMinor) : null,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Wallet</h1>
        <p className="lead">These totals are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Wallet</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Posted profit and withdrawal requests already on your account. Nothing is paid out.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <div className="grid-2">
        <AmountCard label="Posted profit" amountMinor={figures?.profit} />
        <Card>
          <p className="eyebrow">Available withdrawal</p>
          <h2>{amountText(figures?.available)}</h2>
          <p style={{ marginTop: 12 }}>
            <Link href="/withdraw">Withdraw</Link>
          </p>
        </Card>
        <Card>
          <p className="eyebrow">Pending requests</p>
          <h2>{figures?.pendingCount === null ? "Could not total" : figures ? String(figures.pendingCount) : "…"}</h2>
          <p style={{ marginTop: 12 }}>{amountText(figures?.pendingTotal)}</p>
        </Card>
      </div>
    </div>
  );
}

function AmountCard({ label, amountMinor }: { label: string; amountMinor: number | null | undefined }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <h2>{amountText(amountMinor)}</h2>
    </Card>
  );
}

function amountText(amountMinor: number | null | undefined): string {
  if (amountMinor === null) {
    return "Could not total";
  }
  if (typeof amountMinor === "number") {
    return formatUsdtAmount(amountMinor, INVESTMENT_SCALE);
  }
  return "…";
}

function totalMinor<T extends { currency: string; scale: number }>(records: readonly T[], amount: (record: T) => number): number | null {
  if (records.some((record) => record.currency !== INVESTMENT_CURRENCY || record.scale !== INVESTMENT_SCALE)) {
    return null;
  }
  return records.reduce((sum, record) => sum + amount(record), 0);
}

function readError(caught: unknown): string {
  return caught instanceof InvestmentClientError || caught instanceof Error ? caught.message : "Could not load that total.";
}