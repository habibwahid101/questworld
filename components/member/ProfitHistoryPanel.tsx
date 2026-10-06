"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { listCurrentProfits, InvestmentClientError } from "@/lib/investments/client";
import { formatUsdtAmount, type ProfitEntry } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

export function ProfitHistoryPanel() {
  const [profits, setProfits] = useState<ProfitEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());

  const load = useCallback(async () => {
    setProfits(await listCurrentProfits());
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
          const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load profit history.");
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
        <h1>Profit history</h1>
        <p className="lead">Profit history is not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Profit history</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          One monthly entry is 8% of the investment amount. This is not a withdrawal.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {loading ? (
        <Card>
          <p>Loading profit history…</p>
        </Card>
      ) : profits.length === 0 ? (
        <Card>
          <h2>No profit entries yet</h2>
        </Card>
      ) : (
        profits.map((entry) => (
          <Card key={`${entry.investmentId}-${entry.period}`}>
            <p className="eyebrow">{entry.planName}</p>
            <h2>{formatUsdtAmount(entry.profitMinor, entry.scale)}</h2>
            <p style={{ marginTop: 10 }}>Period {entry.period}</p>
            <p>Rate {entry.rateBps / 100}%</p>
          </Card>
        ))
      )}
    </div>
  );
}
