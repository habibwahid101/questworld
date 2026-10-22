"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { AdminRecordTable } from "@/components/admin/AdminRecordTable";
import { useStoredMembers } from "@/components/admin/useStoredMembers";
import { adminTableRow, profitColumns } from "@/lib/admin/table";
import { InvestmentClientError, listAdminProfits } from "@/lib/investments/client";
import { formatUsdtAmount, type ProfitEntry } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const NOT_RUN = "No entries are posted.";

export function AdminProfitsPanel() {
  const [profits, setProfits] = useState<ProfitEntry[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const members = useStoredMembers();

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void listAdminProfits()
      .then((records) => {
        if (active) {
          setProfits(records);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load profit entries.");
        setMessage(error.message);
        setProfits([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Monthly profit</h1>
        <p className="lead">These records are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Monthly profit</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Posted return payments only. This page does not post profit or pay it out.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <AdminRecordTable
        columns={profitColumns}
        loading={profits === null}
        empty={NOT_RUN}
        rows={(profits ?? []).map((entry) =>
          adminTableRow({
            id: `${entry.ownerSub}:${entry.investmentId}:${entry.paymentNumber}`,
            ownerSub: entry.ownerSub,
            members,
            recordedAt: entry.postedAt,
            plan: entry.planName,
            amount: formatUsdtAmount(entry.profitMinor, entry.scale),
            status: "Posted",
          }),
        )}
      />
    </div>
  );
}
