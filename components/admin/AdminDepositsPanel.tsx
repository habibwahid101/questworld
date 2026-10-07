"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, activateVerifiedInvestment, listPendingDeposits, listVerifiedDeposits, readCurrentDepositAddress, reviewPendingDeposit, saveDepositAddress } from "@/lib/investments/client";
import { formatUsdtAmount, type InvestmentRecord } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

export function AdminDepositsPanel() {
  const [pending, setPending] = useState<InvestmentRecord[]>([]);
  const [verified, setVerified] = useState<InvestmentRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [depositAddress, setDepositAddress] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  const load = useCallback(async () => {
    const [pendingDeposits, verifiedDeposits, address] = await Promise.all([
      listPendingDeposits(),
      listVerifiedDeposits(),
      readCurrentDepositAddress(),
    ]);
    setPending(pendingDeposits);
    setVerified(verifiedDeposits);
    setDepositAddress(address);
    setAddressDraft(address);
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

  async function decide(investmentId: string, decision: "deposit_verified" | "rejected") {
    if (savingId || savingAddress) {
      return;
    }
    setSavingId(investmentId);
    setMessage(null);
    try {
      await reviewPendingDeposit(investmentId, decision);
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that review.");
      setMessage(error.message);
    } finally {
      setSavingId(null);
    }
  }

  async function saveAddress() {
    if (savingId || savingAddress) {
      return;
    }
    setSavingAddress(true);
    setMessage(null);
    try {
      const saved = await saveDepositAddress(addressDraft.trim());
      setDepositAddress(saved);
      setAddressDraft(saved);
      setMessage("Binance deposit address saved.");
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that Binance deposit address.");
      setMessage(error.message);
    } finally {
      setSavingAddress(false);
    }
  }

  async function activate(investmentId: string) {
    if (savingId || savingAddress) {
      return;
    }
    setSavingId(investmentId);
    setMessage(null);
    try {
      await activateVerifiedInvestment(investmentId);
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not activate that investment.");
      setMessage(error.message);
    } finally {
      setSavingId(null);
    }
  }

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Deposits</h1>
        <p className="lead">Admin review is not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Deposits</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Review a pending deposit, then activate a verified one. This does not post profit or move money.
        </p>
        <form
          style={{ marginTop: 16 }}
          onSubmit={(event) => {
            event.preventDefault();
            void saveAddress();
          }}
        >
          <label htmlFor="binance-deposit-address">Binance deposit address</label>
          {depositAddress ? null : <p style={{ marginTop: 8 }}>The Binance deposit address is not configured.</p>}
          <input
            id="binance-deposit-address"
            value={addressDraft}
            autoComplete="off"
            onChange={(event) => setAddressDraft(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: 8 }}
          />
          <Button type="submit" disabled={savingAddress || savingId !== null} style={{ marginTop: 12 }}>
            {savingAddress ? "Saving…" : "Save address"}
          </Button>
        </form>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {loading ? (
        <Card>
          <p>Loading pending deposits…</p>
        </Card>
      ) : pending.length === 0 ? (
        <Card>
          <h2>No pending deposits</h2>
        </Card>
      ) : (
        pending.map((investment) => (
          <Card key={investment.investmentId}>
            <p className="eyebrow">{investment.planName}</p>
            <h2>{formatUsdtAmount(investment.amountMinor, investment.scale)}</h2>
            <p style={{ marginTop: 10 }}>Reference {investment.depositReference ?? "—"}</p>
            {investment.depositProofKey ? <p>Screenshot on file</p> : null}
            <p>Submitted {investment.submittedAt ? new Date(investment.submittedAt).toLocaleString() : "—"}</p>
            <div className="grid-2" style={{ marginTop: 16 }}>
              <Button disabled={savingId !== null} onClick={() => void decide(investment.investmentId, "deposit_verified")}>
                {savingId === investment.investmentId ? "Saving…" : "Verify deposit"}
              </Button>
              <Button variant="secondary" disabled={savingId !== null} onClick={() => void decide(investment.investmentId, "rejected")}>
                Reject
              </Button>
            </div>
          </Card>
        ))
      )}
      <Card>
        <h2>Verified deposits</h2>
      </Card>
      {loading ? null : verified.length === 0 ? (
        <Card>
          <p>No verified deposits</p>
        </Card>
      ) : (
        verified.map((investment) => (
          <Card key={investment.investmentId}>
            <p className="eyebrow">{investment.planName}</p>
            <h2>{formatUsdtAmount(investment.amountMinor, investment.scale)}</h2>
            <p style={{ marginTop: 10 }}>Reference {investment.depositReference ?? "—"}</p>
            <p>Verified {investment.reviewedAt ? new Date(investment.reviewedAt).toLocaleString() : "—"}</p>
            <Button disabled={savingId !== null} onClick={() => void activate(investment.investmentId)} style={{ marginTop: 16 }}>
              {savingId === investment.investmentId ? "Saving…" : "Activate investment"}
            </Button>
          </Card>
        ))
      )}
    </div>
  );
}
