"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listAdminInvestments } from "@/lib/investments/client";
import { formatUsdtAmount, type InvestmentRecord, type InvestmentStatus } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  deposit_verified: "Deposit verified",
  rejected: "Rejected",
  active: "Active",
};

export function AdminInvestmentsPanel() {
  const [investments, setInvestments] = useState<InvestmentRecord[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void listAdminInvestments()
      .then((records) => {
        if (active) {
          setInvestments(records);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load investments.");
        setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Investments</h1>
        <p className="lead">These records are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Investments</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Stored investments only. This page does not activate, verify, or reject a deposit.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {investments === null ? (
        <Card>
          <p>Loading investments…</p>
        </Card>
      ) : investments.length === 0 ? (
        <Card>
          <h2>No stored investments</h2>
        </Card>
      ) : (
        investments.map((investment) => (
          <Card key={investment.investmentId}>
            <p className="eyebrow">{statusLabel[investment.status]}</p>
            <h2>{investment.planName}</h2>
            <p style={{ marginTop: 10 }}>{formatUsdtAmount(investment.amountMinor, investment.scale)}</p>
            <p>Owner {investment.ownerSub}</p>
            <p>{investment.depositReference ? `Reference ${investment.depositReference}` : "No reference"}</p>
            <p>Recorded {new Date(investment.createdAt).toLocaleString()}</p>
          </Card>
        ))
      )}
    </div>
  );
}
