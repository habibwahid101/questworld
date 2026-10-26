"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  availableWithdrawalMinor,
  formatUsdtAmount,
  type CommissionEntry,
  type InvestmentRecord,
  type WithdrawalRequest,
} from "@/lib/investments/service";
import { readCurrentMember, readCurrentProfilePhoto, uploadCurrentProfilePhoto } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { MemberProfile } from "@/lib/members/service";
import { ProfilePhoto } from "@/components/member/ProfilePhoto";
import styles from "./DashboardPanel.module.css";

type Figures = {
  received: number | null;
  remaining: number | null;
  generationReceived: number | null;
  available: number | null;
  activeInvested: number | null;
  activeDate: string | null;
};

type HistoryLists = {
  investments: InvestmentRecord[] | null;
  withdrawals: WithdrawalRequest[] | null;
  commissions: CommissionEntry[] | null;
};

export function DashboardPanel() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [figures, setFigures] = useState<Figures | null>(null);
  const [history, setHistory] = useState<HistoryLists>({ investments: null, withdrawals: null, commissions: null });
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
      const withdrawalRows = withdrawals.status === "fulfilled" ? withdrawals.value.withdrawals : null;
      setHistory({
        investments: investmentRows,
        withdrawals: withdrawalRows,
        commissions: commissionRows,
      });
      setFigures({
        received: profitRows ? totalMinor(profitRows, (entry) => entry.profitMinor) : null,
        remaining: profitRows && withdrawalRows ? availableWithdrawalMinor(profitRows, withdrawalRows) : null,
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

  async function onPhoto(file: File) {
    if (uploadingPhoto) {
      return;
    }
    if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
      setPhotoError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > 1_500_000) {
      setPhotoError("Use a JPEG, PNG, or WebP image under 1.5 MB.");
      return;
    }
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadCurrentProfilePhoto({ contentType: file.type, dataBase64 });
      setPhotoUrl(`data:${file.type};base64,${dataBase64}`);
    } catch (caught) {
      setPhotoError(caught instanceof Error ? caught.message : "Could not save that profile photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

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
        <ProfilePhoto
          name={profile?.name ?? "Member"}
          src={photoUrl}
          editable
          uploading={uploadingPhoto}
          onSelect={(file) => void onPhoto(file)}
        >
          <p style={{ marginTop: 0 }}>Name {profile?.name ?? "…"}</p>
          <p>Referral ID {profile?.referralCode ?? "…"}</p>
          <p>Status {profile?.status ?? "…"}</p>
          <p>Joining date {profile ? formatWhen(profile.createdAt) : "…"}</p>
          <p>Active date {figures?.activeDate === null ? "Could not read" : figures?.activeDate ? formatWhen(figures.activeDate) : figures ? "Not active" : "…"}</p>
        </ProfilePhoto>
        {photoError ? (
          <p className="form-error" role="alert">
            {photoError}
          </p>
        ) : null}
      </Card>
      <ExpandableAmountCard
        label="Available to withdraw"
        amountMinor={figures?.available}
        historyLabel="Withdraw history"
        empty="No withdrawal requests yet."
      >
        {history.withdrawals?.map((request) => (
          <p key={request.withdrawalId} className={styles.historyLine}>
            {formatUsdtAmount(request.amountMinor, request.scale)} · {request.status} · {formatWhen(request.createdAt)}
          </p>
        ))}
      </ExpandableAmountCard>
      <ExpandableAmountCard
        label="Investment wallet"
        amountMinor={figures?.activeInvested}
        historyLabel="Investment history"
        empty="No investments yet."
      >
        {history.investments?.map((investment) => (
          <p key={investment.investmentId} className={styles.historyLine}>
            {investment.planName} · {formatUsdtAmount(investment.amountMinor, investment.scale)} · {investment.status} · {formatWhen(investment.createdAt)}
          </p>
        ))}
      </ExpandableAmountCard>
      <ExpandableCard
        label="Return wallet"
        summary={
          <>
            <h2 className={styles.amount}>{amountText(figures?.received)}</h2>
            <p className={styles.line}>Received: {amountText(figures?.received)}</p>
            <p className={styles.line}>Remaining: {amountText(figures?.remaining)}</p>
          </>
        }
        historyLabel="Withdraw history"
        empty="No withdrawal requests yet."
      >
        {history.withdrawals?.map((request) => (
          <p key={`return-${request.withdrawalId}`} className={styles.historyLine}>
            {formatUsdtAmount(request.amountMinor, request.scale)} · {request.status} · {formatWhen(request.createdAt)}
          </p>
        ))}
      </ExpandableCard>
      <ExpandableAmountCard
        label="Commission wallet"
        amountMinor={figures?.generationReceived}
        historyLabel="Referral / Commission history"
        empty="No commission entries yet."
      >
        {history.commissions?.map((entry) => (
          <p key={`${entry.investmentId}-${entry.period}-${entry.generation}`} className={styles.historyLine}>
            Generation {entry.generation} · {formatUsdtAmount(entry.commissionMinor, entry.scale)} · {entry.planName} · {entry.period}
          </p>
        ))}
      </ExpandableAmountCard>
    </div>
  );
}

function ExpandableAmountCard({
  label,
  amountMinor,
  historyLabel,
  empty,
  children,
}: {
  label: string;
  amountMinor: number | null | undefined;
  historyLabel: string;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <ExpandableCard
      label={label}
      summary={<h2 className={styles.amount}>{amountText(amountMinor)}</h2>}
      historyLabel={historyLabel}
      empty={empty}
    >
      {children}
    </ExpandableCard>
  );
}

function ExpandableCard({
  label,
  summary,
  historyLabel,
  empty,
  children,
}: {
  label: string;
  summary: ReactNode;
  historyLabel: string;
  empty: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <Card className={styles.wallet}>
      <button className={styles.expandTrigger} type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <div className={styles.expandCopy}>
          <p className="eyebrow">{label}</p>
          {summary}
        </div>
        <span className={styles.expandIcon} aria-hidden="true">
          {open ? "–" : "+"}
        </span>
      </button>
      {open ? (
        <div className={styles.history}>
          <p className={styles.historyHeading}>{historyLabel}</p>
          {items.length === 0 ? <p className={styles.historyLine}>{empty}</p> : items}
        </div>
      ) : null}
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

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
