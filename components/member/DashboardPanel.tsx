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
  type InvestmentRecord,
} from "@/lib/investments/service";
import { readCurrentMember, readCurrentProfilePhoto } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { MemberProfile } from "@/lib/members/service";
import { ProfilePhoto } from "@/components/member/ProfilePhoto";

type Figures = {
  received: number | null;
  generationReceived: number | null;
  available: number | null;
  activeInvested: number | null;
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
      setFigures({
        received: profitRows ? totalMinor(profitRows, (entry) => entry.profitMinor) : null,
        generationReceived: commissionRows ? totalMinor(commissionRows, (entry) => entry.commissionMinor) : null,
        available: withdrawals.status === "fulfilled" ? withdrawals.value.availableMinor : null,
        activeInvested: investmentRows ? totalMinor(investmentRows.filter((record) => record.status === "active"), (record) => record.amountMinor) : null,
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
        <ProfilePhoto name={profile?.name ?? "Member"} src={photoUrl}>
          <p style={{ marginTop: 0 }}>Name {profile?.name ?? "…"}</p>
          <p>Referral ID {profile?.referralCode ?? "…"}</p>
          <p>Status {profile?.status ?? "…"}</p>
          <p>Joining date {profile ? formatWhen(profile.createdAt) : "…"}</p>
          <p>Active date {figures?.activeDate === null ? "Could not read" : figures?.activeDate ? formatWhen(figures.activeDate) : figures ? "Not active" : "…"}</p>
        </ProfilePhoto>
      </Card>
      <div className="grid-2">
        <AmountCard label="Investment Wallet" amountMinor={figures?.activeInvested} />
        <AmountCard label="Profit Wallet" amountMinor={figures?.received} />
        <AmountCard label="Commission Wallet" amountMinor={figures?.generationReceived} />
        <AmountCard label="Available Withdrawal" amountMinor={figures?.available} />
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

function earliestActivation(records: readonly InvestmentRecord[]): string | null {
  const dates = records.flatMap((record) => (record.activatedAt ? [record.activatedAt] : []));
  return dates.sort()[0] ?? null;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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