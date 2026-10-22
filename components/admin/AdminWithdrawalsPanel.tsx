"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AdminRecordTable } from "@/components/admin/AdminRecordTable";
import { useStoredMembers } from "@/components/admin/useStoredMembers";
import { adminTableRow, withdrawalColumns } from "@/lib/admin/table";
import { InvestmentClientError, listAdminWithdrawals, reviewAdminWithdrawal } from "@/lib/investments/client";
import { formatUsdtAmount, type WithdrawalRequest, type WithdrawalStatus } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const statusLabel: Record<WithdrawalStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function AdminWithdrawalsPanel() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const members = useStoredMembers();

  const load = useCallback(async () => {
    setWithdrawals(await listAdminWithdrawals());
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void load()
      .then(() => undefined)
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load withdrawal requests.");
        setMessage(error.message);
        setWithdrawals([]);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function review(withdrawalId: string, decision: "approved" | "rejected") {
    if (saving) {
      return;
    }
    const prompt = decision === "approved" ? "Approve this withdrawal? Nothing is paid out." : "Reject this withdrawal?";
    if (!window.confirm(prompt)) {
      return;
    }
    setSaving({ id: withdrawalId, decision });
    setMessage(null);
    try {
      await reviewAdminWithdrawal(withdrawalId, decision);
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that review.");
      setMessage(error.message);
    } finally {
      setSaving(null);
    }
  }

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
          Stored withdrawal requests. Approving a request records the decision only. Nothing is paid out.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <AdminRecordTable
        columns={withdrawalColumns}
        loading={withdrawals === null}
        empty="No withdrawal requests stored"
        rows={(withdrawals ?? []).map((request) =>
          adminTableRow({
            id: request.withdrawalId,
            ownerSub: request.ownerSub,
            members,
            recordedAt: request.createdAt,
            amount: formatUsdtAmount(request.amountMinor, request.scale),
            status: statusLabel[request.status],
            reviewedAt: request.reviewedAt,
          }),
        )}
        actions={(row) => {
          const request = withdrawals?.find((item) => item.withdrawalId === row.id);
          if (!request || request.status !== "pending_review") {
            return null;
          }
          return (
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                type="button"
                disabled={saving !== null}
                aria-busy={saving?.id === request.withdrawalId && saving.decision === "approved"}
                onClick={() => void review(request.withdrawalId, "approved")}
              >
                {saving?.id === request.withdrawalId && saving.decision === "approved" ? "Saving…" : "Approve"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving !== null}
                aria-busy={saving?.id === request.withdrawalId && saving.decision === "rejected"}
                onClick={() => void review(request.withdrawalId, "rejected")}
              >
                {saving?.id === request.withdrawalId && saving.decision === "rejected" ? "Saving…" : "Reject"}
              </Button>
            </div>
          );
        }}
      />
    </div>
  );
}