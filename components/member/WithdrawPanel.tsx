"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { InvestmentClientError, listCurrentWithdrawals, requestCurrentWithdrawal } from "@/lib/investments/client";
import { formatUsdtAmount, type WithdrawalRequest, type WithdrawalStatus } from "@/lib/investments/service";
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

  async function requestWithdrawal() {
    if (saving || loading || !transactionPasswordSet) {
      return;
    }
    if (transactionPassword.length === 0) {
      setStatusNote(null);
      setMessage("Enter the transaction password.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setStatusNote(null);
    try {
      await requestCurrentWithdrawal(availableMinor, transactionPassword);
      setTransactionPassword("");
      const error = await load();
      setStatusNote(error ? null : "Withdrawal requested.");
    } catch (caught) {
      setStatusNote(null);
      setMessage(errorMessage(caught, "Could not save that withdrawal request."));
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

  return (
    <div className="stack">
      <Card>
        <h1>Withdraw</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Request the available posted profit. This does not pay out.
        </p>
        <p style={{ marginTop: 10 }}>Available {loading ? "…" : formatUsdtAmount(availableMinor)}</p>
        {transactionPasswordSet === false ? (
          <p style={{ marginTop: 16 }}>
            Set a transaction password first. It is used only to confirm withdrawals.{" "}
            <Link className={styles.profileLink} href="/profile#transaction-password">
              Profile
            </Link>
          </p>
        ) : null}
        {transactionPasswordSet ? (
          <Field label="Transaction password" htmlFor="withdrawal-transaction-password">
            <PasswordField
              id="withdrawal-transaction-password"
              autoComplete="off"
              value={transactionPassword}
              onChange={(event) => setTransactionPassword(event.target.value)}
              disabled={saving || loading}
            />
          </Field>
        ) : null}
        {message ? (
          <p className="form-error" role="alert" style={{ marginTop: 16 }}>
            {message}
          </p>
        ) : statusNote ? (
          <p role="status" style={{ marginTop: 16 }}>
            {statusNote}
          </p>
        ) : null}
        {transactionPasswordSet ? (
          <Button
            disabled={saving || loading}
            onClick={() => void requestWithdrawal()}
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
