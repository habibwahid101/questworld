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
  RETURN_PAYMENTS,
  commissionMinor,
  formatUsdtAmount,
  type CommissionEntry,
  type InvestmentRecord,
} from "@/lib/investments/service";
import { readCurrentMember, readCurrentProfilePhoto } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { MemberProfile } from "@/lib/members/service";
import { ProfilePhoto } from "@/components/member/ProfilePhoto";

type Figures = {
  invested: number | null;
  willReceive: number | null;
  posted: number | null;
  remaining: number | null;
  received: number | null;
  generationExpected: number | null;
  generationReceived: number | null;
  available: number | null;
  activeDate: string | null;
};

export function DashboardPanel() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [figures, setFigures] = useState<Figures | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void Promise.allSettled([
      readCurrentMember(),
      listCurrentInvestments(),
      listCurrentProfits(),
      listCurrentCommissions(),
      listCurrentWithdrawals(),
    ]).then((results) => {
      if (!active) {
        return;
      }
      const [member, investments, profits, commissions, withdrawals] = results;
      const errors = results.flatMap((result) => (result.status === "rejected" ? [readError(result.reason)] : []));
      setMessage(errors[0] ?? null);
      setProfile(member.status === "fulfilled" ? member.value : null);
      const investmentRows = investments.status === "fulfilled" ? investments.value : null;
      const profitRows = profits.status === "fulfilled" ? profits.value : null;
      const commissionRows = commissions.status === "fulfilled" ? commissions.value : null;
      const invested = investmentRows ? totalMinor(cycleInvestments(investmentRows), (record) => record.amountMinor) : null;
      const generation = commissionRows ? generationTotals(commissionRows) : { expected: null, received: null };
      setFigures({
        invested,
        willReceive: invested === null ? null : invested * 2,
        posted: profitRows ? profitRows.length : null,
        remaining: investmentRows ? remainingPayments(investmentRows) : null,
        received: profitRows ? totalMinor(profitRows, (entry) => entry.profitMinor) : null,
        generationExpected: generation.expected,
        generationReceived: generation.received,
        available: withdrawals.status === "fulfilled" ? withdrawals.value.availableMinor : null,
        activeDate: investmentRows ? earliestActivation(investmentRows) : null,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!profile?.hasProfilePhoto) {
      setPhotoUrl(null);
      return;
    }
    let active = true;
    void readCurrentProfilePhoto()
      .then((photo) => {
        if (active) {
          setPhotoUrl(photo ? `data:${photo.contentType};base64,${photo.dataBase64}` : null);
        }
      })
      .catch(() => {
        if (active) {
          setPhotoUrl(null);
        }
      });
    return () => {
      active = false;
    };
  }, [profile]);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <p className="lead">Authentication is connected. These totals are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      {message ? (
        <p className="form-error" role="alert">
          {message}
        </p>
      ) : null}
      <Card>
        <p className="eyebrow">Profile</p>
        <ProfilePhoto name={profile?.name ?? "Member"} src={photoUrl} />
        <p style={{ marginTop: 10 }}>Name {profile?.name ?? "…"}</p>
        <p>Referral ID {profile?.referralCode ?? "…"}</p>
        <p>Status {profile?.status ?? "…"}</p>
        <p>Joining date {profile ? formatWhen(profile.createdAt) : "…"}</p>
        <p>Active date {figures?.activeDate === null ? "Could not read" : figures?.activeDate ? formatWhen(figures.activeDate) : figures ? "Not active" : "…"}</p>
      </Card>
      <div className="grid-2">
        <AmountCard label="Invested" amountMinor={figures?.invested} />
        <AmountCard label="Will receive" amountMinor={figures?.willReceive} note="Double the invested amount." />
        <Card>
          <p className="eyebrow">Months</p>
          <h2>{countText(figures?.posted)} / {countText(figures?.remaining)}</h2>
          <p style={{ marginTop: 8 }}>Posted / remaining</p>
        </Card>
        <AmountCard label="Received so far" amountMinor={figures?.received} />
        <Card>
          <p className="eyebrow">Generation</p>
          <p style={{ marginTop: 10 }}>Expected {amountText(figures?.generationExpected)}</p>
          <p>Received {amountText(figures?.generationReceived)}</p>
        </Card>
        <AmountCard label="Available to withdraw" amountMinor={figures?.available} />
      </div>
    </div>
  );
}

function AmountCard({ label, amountMinor, note }: { label: string; amountMinor: number | null | undefined; note?: string }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <h2>{amountText(amountMinor)}</h2>
      {note ? <p style={{ marginTop: 8 }}>{note}</p> : null}
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

function countText(value: number | null | undefined): string {
  if (value === null) {
    return "—";
  }
  return typeof value === "number" ? String(value) : "…";
}

function cycleInvestments(records: readonly InvestmentRecord[]): InvestmentRecord[] {
  return records.filter((record) => record.status === "active" || record.status === "completed");
}

function remainingPayments(records: readonly InvestmentRecord[]): number | null {
  const cycle = cycleInvestments(records);
  if (cycle.some((record) => record.paymentsPosted !== undefined && (!Number.isInteger(record.paymentsPosted) || record.paymentsPosted < 0 || record.paymentsPosted > RETURN_PAYMENTS))) {
    return null;
  }
  return cycle.reduce((sum, record) => sum + (RETURN_PAYMENTS - (record.paymentsPosted ?? 0)), 0);
}

function earliestActivation(records: readonly InvestmentRecord[]): string | null {
  const dates = records.flatMap((record) => (record.activatedAt ? [record.activatedAt] : []));
  return dates.sort()[0] ?? null;
}

function generationTotals(records: readonly CommissionEntry[]): { expected: number | null; received: number | null } {
  if (records.some((record) => record.currency !== INVESTMENT_CURRENCY || record.scale !== INVESTMENT_SCALE)) {
    return { expected: null, received: null };
  }
  const perPayment = new Map<string, number>();
  for (const entry of records) {
    const amount = commissionMinor(entry.principalMinor, entry.generation);
    const key = `${entry.investmentId}:${entry.generation}`;
    const existing = perPayment.get(key);
    if (existing !== undefined && existing !== amount) {
      return { expected: null, received: null };
    }
    perPayment.set(key, amount);
  }
  let expected = 0;
  for (const amount of perPayment.values()) {
    expected += amount * RETURN_PAYMENTS;
  }
  return {
    expected,
    received: records.reduce((sum, entry) => sum + entry.commissionMinor, 0),
  };
}

function totalMinor<T extends { currency: string; scale: number }>(records: readonly T[], amount: (record: T) => number): number | null {
  if (records.some((record) => record.currency !== INVESTMENT_CURRENCY || record.scale !== INVESTMENT_SCALE)) {
    return null;
  }
  return records.reduce((sum, record) => sum + amount(record), 0);
}

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function readError(caught: unknown): string {
  return caught instanceof InvestmentClientError || caught instanceof Error ? caught.message : "Could not load that total.";
}