"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { InvestmentClientError, listCurrentWithdrawals, requestCurrentWithdrawal } from "@/lib/investments/client";
import { formatUsdtAmount, type WithdrawalRequest, type WithdrawalStatus } from "@/lib/investments/service";
import { formatRecordedAt } from "@/lib/investments/history";
import { isMemberApiConfigured } from "@/lib/members/config";

const statusLabel: Record<WithdrawalStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
};

export function WithdrawPanel() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [availableMinor, setAvailableMinor] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [saving, setSaving] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState("");

  const load = useCallback(async () => {
    const result = await listCurrentWithdrawals();
    setRequests(result.withdrawals);
    setAvailableMinor(result.availableMinor);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void load()
      .catch((caught: unknown) => {
        if (active) {
          const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load withdrawals.");
          setMessage(error.message);
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
    if (saving || availableMinor <= 0 || transactionPassword.length === 0) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await requestCurrentWithdrawal(availableMinor, transactionPassword);
      setTransactionPassword("");
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that withdrawal request.");
      setMessage(error.message);
    } finally {
      setSaving(false);
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
        <Field label="Transaction password" htmlFor="withdrawal-transaction-password">
          <PasswordField
            id="withdrawal-transaction-password"
            autoComplete="off"
            value={transactionPassword}
            onChange={(event) => setTransactionPassword(event.target.value)}
            disabled={saving || loading}
          />
        </Field>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        <Button
          disabled={saving || loading || availableMinor <= 0 || transactionPassword.length === 0}
          onClick={() => void requestWithdrawal()}
          style={{ marginTop: 16 }}
        >
          {saving ? "Saving…" : "Request withdrawal"}
        </Button>
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
