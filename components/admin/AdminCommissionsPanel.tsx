"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listAdminCommissions } from "@/lib/investments/client";
import { formatUsdtAmount, type CommissionEntry } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const NOT_RUN = "No entries are posted. The November schedule has not run.";

export function AdminCommissionsPanel() {
  const [commissions, setCommissions] = useState<CommissionEntry[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      {commissions === null ? (
        <Card>
          <p>Loading commission entries…</p>
        </Card>
      ) : commissions.length === 0 ? (
        <Card>
          <h2>No commission entries</h2>
          <p style={{ marginTop: 10 }}>{NOT_RUN}</p>
        </Card>
      ) : (
        commissions.map((entry) => (
          <Card key={`${entry.recipientSub}:${entry.investmentId}:${entry.period}:${entry.generation}`}>
            <p className="eyebrow">Generation {entry.generation}</p>
            <h2>{formatUsdtAmount(entry.commissionMinor, entry.scale)}</h2>
            <p style={{ marginTop: 10 }}>Recipient {entry.recipientSub}</p>
            <p>Rate {entry.rateBps / 100}%</p>
            <p>Period {entry.period}</p>
            <p>Posted {new Date(entry.postedAt).toLocaleString()}</p>
          </Card>
        ))
      )}
    </div>
  );
}
