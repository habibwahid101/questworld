"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listPendingDeposits, reviewPendingDeposit } from "@/lib/investments/client";
import { formatUsdtAmount, type InvestmentRecord } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

export function AdminDepositsPanel() {
  const [pending, setPending] = useState<InvestmentRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(await listPendingDeposits());
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
    if (savingId) {
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
          Review a pending deposit reference. This does not activate the investment or move money.
        </p>
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
    </div>
  );
}
