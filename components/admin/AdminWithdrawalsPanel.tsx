"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listAdminWithdrawals } from "@/lib/investments/client";
import { formatUsdtAmount, type WithdrawalRequest } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

export function AdminWithdrawalsPanel() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void listAdminWithdrawals()
      .then((records) => {
        if (active) {
          setWithdrawals(records);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load withdrawal requests.");
        setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Withdrawals</h1>
        <p className="lead">These records are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Withdrawals</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Stored withdrawal requests only. This list does not approve or pay a withdrawal.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {withdrawals === null ? (
        <Card>
          <p>Loading withdrawal requests…</p>
        </Card>
      ) : withdrawals.length === 0 ? (
        <Card>
          <h2>No withdrawal requests stored</h2>
        </Card>
      ) : (
        withdrawals.map((request) => (
          <Card key={request.withdrawalId}>
            <p className="eyebrow">{request.status === "pending_review" ? "Pending review" : "Approved"}</p>
            <h2>{formatUsdtAmount(request.amountMinor, request.scale)}</h2>
            <p style={{ marginTop: 10 }}>Owner {request.ownerSub}</p>
            <p>Recorded {new Date(request.createdAt).toLocaleString()}</p>
          </Card>
        ))
      )}
    </div>
  );
}
