"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listCurrentCommissions } from "@/lib/investments/client";
import { formatUsdtAmount, type CommissionEntry, type CommissionGeneration } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const generationLabel: Record<CommissionGeneration, string> = {
  1: "Direct sponsor",
  2: "Second generation",
};

export function CommissionsPanel() {
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());

  const load = useCallback(async () => {
    setCommissions(await listCurrentCommissions());
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
          const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load referral commissions.");
          setMessage(error.message);
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

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Referral commissions</h1>
        <p className="lead">Referral commissions are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Referral commissions</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Direct sponsors receive 3% and second-generation sponsors receive 1%. This is not a payout.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {loading ? (
        <Card>
          <p>Loading referral commissions…</p>
        </Card>
      ) : commissions.length === 0 ? (
        <Card>
          <h2>No commission entries yet</h2>
        </Card>
      ) : (
        commissions.map((entry) => (
          <Card key={`${entry.investmentId}-${entry.period}-${entry.generation}`}>
            <p className="eyebrow">{generationLabel[entry.generation]}</p>
            <h2>{formatUsdtAmount(entry.commissionMinor, entry.scale)}</h2>
            <p style={{ marginTop: 10 }}>{entry.planName}</p>
            <p>Period {entry.period}</p>
            <p>Rate {entry.rateBps / 100}%</p>
          </Card>
        ))
      )}
    </div>
  );
}
