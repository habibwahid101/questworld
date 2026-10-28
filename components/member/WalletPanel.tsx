"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listCurrentCommissions, listCurrentInvestments, listCurrentProfits, listCurrentWithdrawals } from "@/lib/investments/client";
import {
  INVESTMENT_CURRENCY,
  INVESTMENT_SCALE,
  availableWithdrawalMinor,
  formatUsdtAmount,
} from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

type Figures = {
  profit: number | null;
  remaining: number | null;
  available: number | null;
  activeInvested: number | null;
  commissions: number | null;
};

export function WalletPanel() {
  const [figures, setFigures] = useState<Figures | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void Promise.allSettled([
      listCurrentProfits(),
      listCurrentWithdrawals(),
      listCurrentInvestments(),
      listCurrentCommissions(),
    ]).then((results) => {
      if (!active) {
        return;
      }
      const [profits, withdrawals, investments, commissions] = results;
      const errors = results.flatMap((result) => (result.status === "rejected" ? [readError(result.reason)] : []));
      setMessage(errors[0] ?? null);
      const investmentRows = investments.status === "fulfilled" ? investments.value : null;
      const commissionRows = commissions.status === "fulfilled" ? commissions.value : null;
      const profitRows = profits.status === "fulfilled" ? profits.value : null;
      const withdrawalRows = withdrawals.status === "fulfilled" ? withdrawals.value.withdrawals : null;
      setFigures({
        profit: profitRows ? totalMinor(profitRows, (entry) => entry.profitMinor) : null,
        remaining: profitRows && withdrawalRows ? availableWithdrawalMinor(profitRows, withdrawalRows) : null,
        available: withdrawals.status === "fulfilled" ? withdrawals.value.availableMinor : null,
        activeInvested: investmentRows ? totalMinor(investmentRows.filter((record) => record.status === "active"), (record) => record.amountMinor) : null,
        commissions: commissionRows ? totalMinor(commissionRows, (entry) => entry.commissionMinor) : null,
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
      <div className="stack">
        <AmountCard label="Available to withdraw" amountMinor={figures?.available} href="/transactions#withdrawal-history" />
        <AmountCard label="Investment wallet" amountMinor={figures?.activeInvested} href="/transactions#investment-history" />
        <Card>
          <p className="eyebrow">Return wallet</p>
          <h2>{amountText(figures?.profit)}</h2>
          <p>Received: {amountText(figures?.profit)}</p>
          <p>Remaining: {amountText(figures?.remaining)}</p>
          <p>
            <Link href="/transactions#return-history">View history</Link>
          </p>
        </Card>
        <AmountCard label="Commission wallet" amountMinor={figures?.commissions} href="/transactions#commission-history" />
        <p>
          <Link href="/withdraw">Withdraw</Link>
        </p>
      </div>
    </div>
  );
}

function AmountCard({ label, amountMinor, href }: { label: string; amountMinor: number | null | undefined; href: string }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <h2>{amountText(amountMinor)}</h2>
      <p>
        <Link href={href}>View history</Link>
      </p>
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