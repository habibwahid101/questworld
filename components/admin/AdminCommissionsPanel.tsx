"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { AdminRecordTable } from "@/components/admin/AdminRecordTable";
import { useStoredMembers } from "@/components/admin/useStoredMembers";
import { adminTableRow, profitColumns } from "@/lib/admin/table";
import { InvestmentClientError, listAdminCommissions } from "@/lib/investments/client";
import { formatUsdtAmount, type CommissionEntry } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const NOT_RUN = "No entries are posted.";

export function AdminCommissionsPanel() {
  const [commissions, setCommissions] = useState<CommissionEntry[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const members = useStoredMembers();

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void listAdminCommissions()
      .then((records) => {
        if (active) {
          setCommissions(records);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load commission entries.");
        setMessage(error.message);
        setCommissions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Referral commissions</h1>
        <p className="lead">These records are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Referral commissions</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Posted 3 percent and 1 percent entries only. This page does not post or pay a commission.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <AdminRecordTable
        columns={profitColumns}
        loading={commissions === null}
        empty={NOT_RUN}
        rows={(commissions ?? []).map((entry) =>
          adminTableRow({
            id: `${entry.recipientSub}:${entry.investmentId}:${entry.paymentNumber}:${entry.generation}`,
            ownerSub: entry.recipientSub,
            members,
            recordedAt: entry.postedAt,
            plan: entry.planName,
            amount: formatUsdtAmount(entry.commissionMinor, entry.scale),
            status: "Posted",
          }),
        )}
      />
    </div>
  );
}
