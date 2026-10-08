"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  InvestmentClientError,
  listCurrentCommissions,
  listCurrentInvestments,
  listCurrentProfits,
  listCurrentWithdrawals,
} from "@/lib/investments/client";
import {
  INVESTMENT_CURRENCY,
  INVESTMENT_SCALE,
  formatUsdtAmount,
} from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

type Figures = {
  active: number | null;
  profit: number | null;
  commission: number | null;
  available: number | null;
};

export function DashboardPanel() {
  const [figures, setFigures] = useState<Figures | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void Promise.allSettled([
      listCurrentInvestments(),
      listCurrentProfits(),
      listCurrentCommissions(),
      listCurrentWithdrawals(),
    ]).then((results) => {
      if (!active) {
        return;
      }
      const [investments, profits, commissions, withdrawals] = results;
      const errors = results.flatMap((result) => (result.status === "rejected" ? [readError(result.reason)] : []));
      setMessage(errors[0] ?? null);
      setFigures({
        active: investments.status === "fulfilled" ? totalMinor(investments.value.filter((record) => record.status === "active"), (record) => record.amountMinor) : null,
        profit: profits.status === "fulfilled" ? totalMinor(profits.value, (entry) => entry.profitMinor) : null,
        commission: commissions.status === "fulfilled" ? totalMinor(commissions.value, (entry) => entry.commissionMinor) : null,
        available: withdrawals.status === "fulfilled" ? withdrawals.value.availableMinor : null,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Dashboard</h1>
        <p className="lead">Authentication is connected. These totals are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Dashboard</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Totals come from your recorded investments, posted profit, posted commissions, and available withdrawal. Nothing is paid out here.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <div className="grid-2">
        <AmountCard label="Active investment" amountMinor={figures?.active} />
        <AmountCard label="Posted profit" amountMinor={figures?.profit} />
        <AmountCard label="Referral commission" amountMinor={figures?.commission} />
        <AmountCard label="Available withdrawal" amountMinor={figures?.available} />
      </div>
    </div>
  );
}

function AmountCard({ label, amountMinor }: { label: string; amountMinor: number | null | undefined }) {
  let value = "…";
  if (amountMinor === null) {
    value = "Could not total";
  } else if (typeof amountMinor === "number") {
    value = formatUsdtAmount(amountMinor, INVESTMENT_SCALE);
  }
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <h2>{value}</h2>
    </Card>
  );
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

