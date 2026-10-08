"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listAdminProfits } from "@/lib/investments/client";
import { formatUsdtAmount, type ProfitEntry } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const NOT_RUN = "No entries are posted. The November schedule has not run.";

export function AdminProfitsPanel() {
  const [profits, setProfits] = useState<ProfitEntry[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
          Posted 8 percent entries only. This page does not post profit or pay it out.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {profits === null ? (
        <Card>
          <p>Loading profit entries…</p>
        </Card>
      ) : profits.length === 0 ? (
        <Card>
          <h2>No profit entries</h2>
          <p style={{ marginTop: 10 }}>{NOT_RUN}</p>
        </Card>
      ) : (
        profits.map((entry) => (
          <Card key={`${entry.ownerSub}:${entry.investmentId}:${entry.period}`}>
            <p className="eyebrow">{entry.planName}</p>
            <h2>{formatUsdtAmount(entry.profitMinor, entry.scale)}</h2>
            <p style={{ marginTop: 10 }}>Owner {entry.ownerSub}</p>
            <p>Period {entry.period}</p>
            <p>Rate {entry.rateBps / 100}%</p>
            <p>Posted {new Date(entry.postedAt).toLocaleString()}</p>
          </Card>
        ))
      )}
    </div>
  );
}
