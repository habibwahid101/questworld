"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { InvestmentClientError, listCurrentWithdrawals, requestCurrentWithdrawal } from "@/lib/investments/client";
import { formatUsdtAmount, INVESTMENT_SCALE, type WithdrawalRequest, type WithdrawalStatus } from "@/lib/investments/service";
import { formatRecordedAt } from "@/lib/investments/history";
import { MemberClientError, readCurrentMember } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import styles from "./WithdrawPanel.module.css";

const statusLabel: Record<WithdrawalStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function WithdrawPanel() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [availableMinor, setAvailableMinor] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [saving, setSaving] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState("");
  const [transactionPasswordSet, setTransactionPasswordSet] = useState<boolean | null>(null);
  const [amountText, setAmountText] = useState("");
  const [walletText, setWalletText] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [withdrawals, profile] = await Promise.allSettled([listCurrentWithdrawals(), readCurrentMember()]);
    const errors: string[] = [];
    if (withdrawals.status === "fulfilled") {
      setRequests(withdrawals.value.withdrawals);
      setAvailableMinor(withdrawals.value.availableMinor);
    } else {
      errors.push(errorMessage(withdrawals.reason, "Could not load withdrawals."));
    }
    if (profile.status === "fulfilled") {
      setTransactionPasswordSet(profile.value.transactionPasswordSet);
    } else {
      errors.push(errorMessage(profile.reason, "Could not load your profile."));
    }
    setMessage(errors[0] ?? null);
    setStatusNote(errors.length === 0 && profile.status === "fulfilled" && profile.value.transactionPasswordSet ? "Transaction password is set." : null);
    return errors[0] ?? null;
  }, []);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void load()
      .catch((caught: unknown) => {
        if (active) {
          setMessage(errorMessage(caught, "Could not load withdrawals."));
          setStatusNote(null);
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
  }, [load]);

  async function requestWithdrawal(amountMinor: number) {
    if (saving || loading || !transactionPasswordSet || transactionPassword.length === 0) {
      return;
    }
    setSaving(true);
    setMessage(null);
    setAmountError(null);
    setPasswordError(null);
    setStatusNote(null);
    try {
      await requestCurrentWithdrawal(amountMinor, transactionPassword);
      setAmountText("");
      setWalletText("");
      setTransactionPassword("");
      const error = await load();
      setStatusNote(error ? null : "Withdrawal requested.");
    } catch (caught) {
      setStatusNote(null);
      const text = errorMessage(caught, "Could not save that withdrawal request.");
      if (/password/i.test(text)) {
        setPasswordError(text);
      } else {
        setAmountError(text);
      }
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Withdraw</h1>
        <p className="lead">Withdrawal requests are not connected in this build yet.</p>
      </Card>
    );
  }

  const parsedAmount = parseWithdrawalAmount(amountText);
  const amountAlert = loading ? null : amountAlertText(amountText, parsedAmount, availableMinor);
  const amountReady = !loading && parsedAmount !== null && amountAlert === null;

  return (
    <div className="stack">
      <Card>
        <h1>Withdraw</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Request the available posted profit. This does not pay out.
        </p>
        <p style={{ marginTop: 10 }}>Available {loading ? "…" : formatUsdtAmount(availableMinor)}</p>
        <Field label="Amount" htmlFor="withdrawal-amount" error={amountError ?? amountAlert}>
          <Input
            id="withdrawal-amount"
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            onChange={(event) => {
              setAmountText(event.target.value);
              setAmountError(null);
            }}
            disabled={saving || loading}
          />
        </Field>
        <Field label="Transaction wallet" htmlFor="withdrawal-wallet">
          <Input
            id="withdrawal-wallet"
            autoComplete="off"
            value={walletText}
            onChange={(event) => setWalletText(event.target.value)}
            disabled={saving || loading}
          />
        </Field>
        {transactionPasswordSet === false ? (
          <p>
            Set a transaction password first. It is used only to confirm withdrawals.{" "}
            <Link className={styles.profileLink} href="/profile#transaction-password">
              Profile
            </Link>
          </p>
        ) : null}
        {transactionPasswordSet ? (
          <Field label="Transaction password" htmlFor="withdrawal-transaction-password" error={passwordError}>
            <PasswordField
              id="withdrawal-transaction-password"
              autoComplete="off"
              value={transactionPassword}
              onChange={(event) => {
                setTransactionPassword(event.target.value);
                setPasswordError(null);
              }}
              disabled={saving || loading}
            />
          </Field>
        ) : null}
        {statusNote ? (
          <p role="status">{statusNote}</p>
        ) : null}
        {message ? (
          <p className="form-error" role="alert">
            {message}
          </p>
        ) : null}
        {transactionPasswordSet ? (
          <Button
            disabled={saving || loading || !amountReady || transactionPassword.length === 0}
            aria-busy={saving}
            onClick={() => {
              if (parsedAmount !== null) {
                void requestWithdrawal(parsedAmount);
              }
            }}
            style={{ marginTop: 16 }}
          >
            {saving ? "Saving…" : "Request withdrawal"}
          </Button>
        ) : null}
      </Card>
      {loading ? (
        <Card>
          <p>Loading withdrawal requests…</p>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <h2>No withdrawal requests yet</h2>
        </Card>
      ) : (
        requests.map((request) => (
          <Card key={request.withdrawalId}>
            <p className="eyebrow">{statusLabel[request.status]}</p>
            <h2>{formatUsdtAmount(request.amountMinor, request.scale)}</h2>
            <p style={{ marginTop: 10 }}>
              {statusLabel[request.status]}. Date and time {formatRecordedAt(request.createdAt)}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}

function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof InvestmentClientError || caught instanceof MemberClientError) {
    return caught.message;
  }
  if (caught instanceof Error && caught.message) {
    return caught.message;
  }
  return fallback;
}

function parseWithdrawalAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (whole.length > 12 || fraction.length > INVESTMENT_SCALE) {
    return null;
  }
  const minor = Number(whole) * 10 ** INVESTMENT_SCALE + Number(fraction.padEnd(INVESTMENT_SCALE, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

function amountAlertText(raw: string, parsed: number | null, availableMinor: number): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith("-") || parsed === 0) {
    return "Enter an amount above zero.";
  }
  if (parsed === null) {
    return "Enter a valid amount.";
  }
  if (parsed > availableMinor) {
    return "That amount is above the available balance.";
  }
  return null;
}
