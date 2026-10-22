"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { AdminRecordTable } from "@/components/admin/AdminRecordTable";
import { useStoredMembers } from "@/components/admin/useStoredMembers";
import { adminTableRow, investmentColumns } from "@/lib/admin/table";
import { InvestmentClientError, listAdminInvestments } from "@/lib/investments/client";
import { formatUsdtAmount, type InvestmentRecord, type InvestmentStatus } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  deposit_verified: "Deposit verified",
  rejected: "Rejected",
  active: "Active",
  completed: "Completed",
};

export function AdminInvestmentsPanel() {
  const [investments, setInvestments] = useState<InvestmentRecord[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const members = useStoredMembers();

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
        setInvestments([]);
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
      <AdminRecordTable
        columns={investmentColumns}
        loading={investments === null}
        empty="No stored investments"
        rows={(investments ?? []).map((investment) =>
          adminTableRow({
            id: investment.investmentId,
            ownerSub: investment.ownerSub,
            members,
            recordedAt: investment.createdAt,
            plan: investment.planName,
            amount: formatUsdtAmount(investment.amountMinor, investment.scale),
            status: statusLabel[investment.status],
            reference: investment.depositReference,
            submittedAt: investment.submittedAt,
            reviewedAt: investment.reviewedAt,
            activatedAt: investment.activatedAt,
            nextDueAt: investment.nextDueAt,
            paymentsPosted: investment.paymentsPosted,
          }),
        )}
      />
    </div>
  );
}
