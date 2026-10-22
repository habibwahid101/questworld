"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
import { readCurrentMember, readCurrentProfilePhoto, uploadCurrentProfilePhoto } from "@/lib/members/client";
import { memberReferralUrl } from "@/lib/members/referral-url";
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
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"id" | "link" | null>(null);
  const copyTimer = useRef<number | null>(null);
  const [figures, setFigures] = useState<Figures | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    return () => {
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
    };
  }, []);

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

  async function copyReferral(kind: "id" | "link") {
    const code = profile?.referralCode ?? "";
    if (!code || (kind === "link" && !origin)) {
      return;
    }
    const copiedOk = await writeClipboard(kind === "id" ? code : memberReferralUrl(origin, code));
    if (!copiedOk) {
      return;
    }
    setCopied(kind);
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
    }
    copyTimer.current = window.setTimeout(() => {
      setCopied((current) => (current === kind ? null : current));
    }, 2000);
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
        <div className="stack" style={{ marginTop: 16 }}>
          <Button variant="secondary" onClick={() => void copyReferral("id")} disabled={!profile?.referralCode}>
            {copied === "id" ? "Copied" : "Copy Referral ID"}
          </Button>
          <Button variant="secondary" onClick={() => void copyReferral("link")} disabled={!profile?.referralCode || !origin}>
            {copied === "link" ? "Copied" : "Copy Referral Link"}
          </Button>
        </div>
      </Card>
      <AmountCard label="Investment Wallet" amountMinor={figures?.activeInvested} />
      <AmountCard label="Profit Wallet" amountMinor={figures?.received} />
      <AmountCard label="Commission Wallet" amountMinor={figures?.generationReceived} />
      <AmountCard label="Available Withdrawal" amountMinor={figures?.available} />
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

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const copiedOk = document.execCommand("copy");
    area.remove();
    return copiedOk;
  }
}