"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  type InvestmentRecord,
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

export function DashboardPanel() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
      const withdrawalRows = withdrawals.status === "fulfilled" ? withdrawals.value.withdrawals : null;
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
      const saved = await uploadCurrentProfilePhoto({ contentType: file.type, dataBase64 });
      setProfile(saved);
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
      <AmountCard
        label="Investment wallet"
        amountMinor={figures?.activeInvested}
        tone="investment"
        href="/transactions#investment-history"
        icon={<WalletIcon />}
      />
      <Card className={`${styles.wallet} ${styles.return}`}>
        <div className={styles.row}>
          <div className={styles.icon} aria-hidden>
            <TrendIcon />
          </div>
          <div className={styles.content}>
            <p className="eyebrow">Return wallet</p>
            <h2 className={styles.amount}>{amountText(figures?.received)}</h2>
            <p className={styles.line}>Received: {amountText(figures?.received)}</p>
            <p className={styles.line}>Remaining: {amountText(figures?.remaining)}</p>
            <HistoryLink href="/transactions#return-history" />
          </div>
        </div>
      </Card>
      <AmountCard
        label="Commission wallet"
        amountMinor={figures?.generationReceived}
        tone="commission"
        href="/transactions#commission-history"
        icon={<PeopleIcon />}
      />
      <AmountCard
        label="Available to withdraw"
        amountMinor={figures?.available}
        tone="available"
        href="/transactions#withdrawal-history"
        icon={<BankIcon />}
      />
    </div>
  );
}

function AmountCard({
  label,
  amountMinor,
  tone,
  href,
  icon,
}: {
  label: string;
  amountMinor: number | null | undefined;
  tone: "available" | "investment" | "commission";
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className={`${styles.wallet} ${styles[tone]}`}>
      <div className={styles.row}>
        <div className={styles.icon} aria-hidden>
          {icon}
        </div>
        <div className={styles.content}>
          <p className="eyebrow">{label}</p>
          <h2 className={styles.amount}>{amountText(amountMinor)}</h2>
          <HistoryLink href={href} />
        </div>
      </div>
    </Card>
  );
}

function HistoryLink({ href }: { href: string }) {
  return (
    <p className={styles.line}>
      <Link href={href}>View history →</Link>
    </p>
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

function WalletIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="5" y1="21" x2="5" y2="10" />
      <line x1="19" y1="21" x2="19" y2="10" />
      <line x1="9" y1="21" x2="9" y2="10" />
      <line x1="15" y1="21" x2="15" y2="10" />
      <polyline points="3 10 12 3 21 10" />
    </svg>
  );
}