"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { AdminRecordTable } from "@/components/admin/AdminRecordTable";
import { useStoredMembers } from "@/components/admin/useStoredMembers";
import { adminTableRow, withdrawalColumns } from "@/lib/admin/table";
import { InvestmentClientError, listAdminWithdrawals, recordAdminPayout, reviewAdminWithdrawal } from "@/lib/investments/client";
import { formatUsdtAmount, type WithdrawalRequest, type WithdrawalStatus } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const statusLabel: Record<WithdrawalStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
};

export function AdminWithdrawalsPanel() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ id: string; decision: "approved" | "rejected" | "paid" } | null>(null);
  const [hashById, setHashById] = useState<Record<string, string>>({});
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
    const prompt = decision === "approved" ? "Approve this withdrawal? Send the USDT manually before marking it paid." : "Reject this withdrawal?";
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

  async function markPaid(withdrawalId: string) {
    if (saving) {
      return;
    }
    const transactionHash = hashById[withdrawalId]?.trim() ?? "";
    if (!transactionHash) {
      setMessage("Enter the blockchain transaction hash.");
      return;
    }
    if (!window.confirm("Mark this withdrawal paid with the transaction hash you entered? QW does not send the transfer.")) {
      return;
    }
    setSaving({ id: withdrawalId, decision: "paid" });
    setMessage(null);
    try {
      await recordAdminPayout(withdrawalId, transactionHash);
      setHashById((current) => ({ ...current, [withdrawalId]: "" }));
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not record that payout.");
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
          Stored withdrawal requests. Approving a request does not send USDT. Mark paid only after you send it and have the transaction hash.
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
            reference: request.payoutReference,
            reviewedAt: request.reviewedAt,
          }),
        )}
        actions={(row) => {
          const request = withdrawals?.find((item) => item.withdrawalId === row.id);
          if (!request || (request.status !== "pending_review" && request.status !== "approved")) {
            return null;
          }
          if (request.status === "approved") {
            if (!request.network || !request.destination) {
              return null;
            }
            return (
              <div style={{ display: "grid", gap: 8 }}>
                <p>
                  {request.network} {request.destination}
                </p>
                <Field label="Transaction hash" htmlFor={`payout-${request.withdrawalId}`}>
                  <Input
                    id={`payout-${request.withdrawalId}`}
                    value={hashById[request.withdrawalId] ?? ""}
                    onChange={(event) => setHashById((current) => ({ ...current, [request.withdrawalId]: event.target.value }))}
                    disabled={saving !== null}
                    autoComplete="off"
                  />
                </Field>
                <Button
                  type="button"
                  disabled={saving !== null}
                  aria-busy={saving?.id === request.withdrawalId && saving.decision === "paid"}
                  onClick={() => void markPaid(request.withdrawalId)}
                >
                  {saving?.id === request.withdrawalId && saving.decision === "paid" ? "Saving…" : "Mark paid"}
                </Button>
              </div>
            );
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