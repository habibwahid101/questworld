"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AdminRecordTable } from "@/components/admin/AdminRecordTable";
import { useStoredMembers } from "@/components/admin/useStoredMembers";
import { adminTableRow, investmentColumns } from "@/lib/admin/table";
import { InvestmentClientError, activateVerifiedInvestment, createAdminDeposit, listPendingDeposits, listVerifiedDeposits, readCurrentDepositAddresses, readDepositProofUrl, reviewPendingDeposit, saveDepositAddresses } from "@/lib/investments/client";
import { formatUsdtAmount, type InvestmentRecord, type InvestmentStatus } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";
import styles from "./AdminDepositsPanel.module.css";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  deposit_verified: "Deposit verified",
  rejected: "Rejected",
  active: "Active",
  completed: "Completed",
};

export function AdminDepositsPanel() {
  const [pending, setPending] = useState<InvestmentRecord[]>([]);
  const [verified, setVerified] = useState<InvestmentRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [depositEmail, setDepositEmail] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [saving, setSaving] = useState<{ id: string; kind: "verify" | "reject" | "activate" | "screenshot" } | null>(null);
  const [bep20Draft, setBep20Draft] = useState("");
  const [trc20Draft, setTrc20Draft] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const members = useStoredMembers();

  const load = useCallback(async () => {
    const [pendingDeposits, verifiedDeposits, wallets] = await Promise.all([
      listPendingDeposits(),
      listVerifiedDeposits(),
      readCurrentDepositAddresses(),
    ]);
    setPending(pendingDeposits);
    setVerified(verifiedDeposits);
    setBep20Draft(wallets.bep20);
    setTrc20Draft(wallets.trc20);
    setMessage(null);
  }, []);

  useEffect(() => {
    let active = true;
    void load()
      .catch((caught: unknown) => {
        if (active) {
          setMessage(caught instanceof Error ? caught.message : "Could not load pending deposits.");
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

  async function adminDeposit() {
    if (depositing || !depositEmail || !depositAmount) {
      return;
    }
    const member = (members ?? []).find((item) => item.email.toLowerCase() === depositEmail.toLowerCase());
    if (!member) {
      setMessage("That member was not found.");
      return;
    }
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }
    setDepositing(true);
    setMessage(null);
    try {
      await createAdminDeposit(member.userId, "custom", Math.round(amount * 1_000_000));
      setMessage("Deposit created and activated.");
      setDepositEmail("");
      setDepositAmount("");
      await load();
    } catch (caught) {
      setMessage(caught instanceof InvestmentClientError ? caught.message : "Could not create that deposit.");
    } finally {
      setDepositing(false);
    }
  }

  async function decide(investmentId: string, decision: "deposit_verified" | "rejected") {
    if (saving || savingAddress) {
      return;
    }
    if (decision === "rejected" && !window.confirm("Reject this deposit?")) {
      return;
    }
    setSaving({ id: investmentId, kind: decision === "rejected" ? "reject" : "verify" });
    setMessage(null);
    try {
      await reviewPendingDeposit(investmentId, decision, decision === "rejected" ? reasons[investmentId] : undefined);
      setMessage(decision === "rejected" ? "Deposit rejected." : "Deposit confirmed.");
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that review.");
      setMessage(error.message);
    } finally {
      setSaving(null);
    }
  }

  async function openScreenshot(investmentId: string) {
    if (saving || savingAddress) {
      return;
    }
    setSaving({ id: investmentId, kind: "screenshot" });
    setMessage(null);
    try {
      const url = await readDepositProofUrl(investmentId);
      if (!window.open(url, "_blank", "noopener,noreferrer")) {
        setMessage("Could not open that screenshot.");
      }
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not open that screenshot.");
      setMessage(error.message);
    } finally {
      setSaving(null);
    }
  }

  async function saveAddress() {
    if (saving || savingAddress) {
      return;
    }
    setSavingAddress(true);
    setMessage(null);
    try {
      const saved = await saveDepositAddresses({ bep20: bep20Draft.trim(), trc20: trc20Draft.trim() });
      setBep20Draft(saved.bep20);
      setTrc20Draft(saved.trc20);
      setMessage("Deposit addresses saved.");
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save those deposit addresses.");
      setMessage(error.message);
    } finally {
      setSavingAddress(false);
    }
  }

  async function activate(investmentId: string) {
    if (saving || savingAddress) {
      return;
    }
    setSaving({ id: investmentId, kind: "activate" });
    setMessage(null);
    try {
      await activateVerifiedInvestment(investmentId);
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not activate that investment.");
      setMessage(error.message);
    } finally {
      setSaving(null);
    }
  }

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Deposits</h1>
        <p className="lead">Admin review is not connected in this build yet.</p>
      </Card>
      <Card>
        <h2>Deposit for a member</h2>
        <p className="lead" style={{ marginTop: 8 }}>Creates an active investment for the member. This does not move money.</p>
        <form className="stack" style={{ marginTop: 16 }} onSubmit={(event) => { event.preventDefault(); void adminDeposit(); }}>
          <div>
            <label htmlFor="admin-deposit-email">Member email</label>
            <select id="admin-deposit-email" value={depositEmail} onChange={(event) => setDepositEmail(event.target.value)} style={{ display: "block", width: "100%", marginTop: 8 }}>
              <option value="">Choose a member</option>
              {(members ?? []).map((member) => (
                <option key={member.userId} value={member.email}>{member.name} ({member.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-deposit-amount">Amount (USDT)</label>
            <input id="admin-deposit-amount" type="number" min="1" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} style={{ display: "block", width: "100%", marginTop: 8 }} />
          </div>
          <Button type="submit" disabled={depositing || !depositEmail || !depositAmount} aria-busy={depositing}>
            {depositing ? "Creating…" : "Create deposit"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Deposits</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Review a pending deposit. Confirming it activates the investment. This does not post profit or move money.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void saveAddress();
          }}
        >
          <div>
            <label htmlFor="deposit-bep20">BEP20</label>
            <input
              id="deposit-bep20"
              value={bep20Draft}
              autoComplete="off"
              onChange={(event) => setBep20Draft(event.target.value)}
              style={{ display: "block", width: "100%", marginTop: 8 }}
            />
          </div>
          <div>
            <label htmlFor="deposit-trc20">TRC20</label>
            <input
              id="deposit-trc20"
              value={trc20Draft}
              autoComplete="off"
              onChange={(event) => setTrc20Draft(event.target.value)}
              style={{ display: "block", width: "100%", marginTop: 8 }}
            />
          </div>
          <Button type="submit" disabled={savingAddress || saving !== null} aria-busy={savingAddress}>
            {savingAddress ? "Saving…" : "Save addresses"}
          </Button>
        </form>
        {message ? <p className="notice notice-success" style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      
      <AdminRecordTable
        columns={investmentColumns}
        loading={loading}
        empty="No deposits"
        rows={[...pending, ...verified].map((investment) =>
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
        actions={(row) => {
          const investment = [...pending, ...verified].find((item) => item.investmentId === row.id);
          if (!investment) {
            return null;
          }
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
              {investment.depositProofKey ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving !== null}
                  aria-busy={saving?.id === investment.investmentId && saving.kind === "screenshot"}
                  onClick={() => void openScreenshot(investment.investmentId)}
                >
                  {saving?.id === investment.investmentId && saving.kind === "screenshot" ? "Please wait" : "Open screenshot"}
                </Button>
              ) : null}
              {investment.status === "pending_verification" || investment.status === "deposit_verified" ? (
                <Button
                  disabled={saving !== null}
                  aria-busy={saving?.id === investment.investmentId && (saving.kind === "verify" || saving.kind === "activate")}
                  onClick={() =>
                    void (investment.status === "pending_verification"
                      ? decide(investment.investmentId, "deposit_verified")
                      : activate(investment.investmentId))
                  }
                >
                  {saving?.id === investment.investmentId && (saving.kind === "verify" || saving.kind === "activate") ? "Saving…" : "Confirm"}
                </Button>
              ) : null}
              {investment.status === "pending_verification" ? (
                <>
                  <input
                    id={`reject-reason-${investment.investmentId}`}
                    type="text"
                    placeholder="Rejection reason"
                    value={reasons[investment.investmentId] ?? ""}
                    maxLength={500}
                    onChange={(event) => setReasons((current) => ({ ...current, [investment.investmentId]: event.target.value }))}
                    style={{ width: 140, padding: "6px 8px" }}
                  />
                  <Button
                    variant="secondary"
                    disabled={saving !== null}
                    aria-busy={saving?.id === investment.investmentId && saving.kind === "reject"}
                    onClick={() => void decide(investment.investmentId, "rejected")}
                  >
                    {saving?.id === investment.investmentId && saving.kind === "reject" ? "Saving…" : "Reject"}
                  </Button>
                </>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}
