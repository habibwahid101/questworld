"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listAdminInvestments, listAdminWithdrawals, listPendingDeposits, listVerifiedDeposits } from "@/lib/investments/client";
import { INVESTMENT_CURRENCY, INVESTMENT_SCALE, formatUsdtAmount } from "@/lib/investments/service";
import { listStoredMembers } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";

export function AdminOverviewPanel() {
  const [pending, setPending] = useState<number | null>();
  const [verified, setVerified] = useState<number | null>();
  const [memberCount, setMemberCount] = useState<number | null>();
  const [activeCount, setActiveCount] = useState<number | null>();
  const [activeTotal, setActiveTotal] = useState<number | null>();
  const [pendingWithdrawals, setPendingWithdrawals] = useState<number | null>();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void Promise.allSettled([
      listPendingDeposits(),
      listVerifiedDeposits(),
      listStoredMembers(),
      listAdminInvestments(),
      listAdminWithdrawals(),
    ]).then(([pendingResult, verifiedResult, membersResult, investmentsResult, withdrawalsResult]) => {
      if (!active) {
        return;
      }
      setPending(pendingResult.status === "fulfilled" ? pendingResult.value.length : null);
      setVerified(verifiedResult.status === "fulfilled" ? verifiedResult.value.length : null);
      setMemberCount(membersResult.status === "fulfilled" ? membersResult.value.length : null);
      if (investmentsResult.status === "fulfilled") {
        const activeInvestments = investmentsResult.value.filter((record) => record.status === "active");
        setActiveCount(activeInvestments.length);
        setActiveTotal(
          activeInvestments.every((record) => record.currency === INVESTMENT_CURRENCY && record.scale === INVESTMENT_SCALE)
            ? activeInvestments.reduce((sum, record) => sum + record.amountMinor, 0)
            : null,
        );
      } else {
        setActiveCount(null);
        setActiveTotal(null);
      }
      setPendingWithdrawals(
        withdrawalsResult.status === "fulfilled"
          ? withdrawalsResult.value.filter((request) => request.status === "pending_review").length
          : null,
      );
      const failed = [pendingResult, verifiedResult, membersResult, investmentsResult, withdrawalsResult].find((result) => result.status === "rejected");
      if (failed?.status === "rejected") {
        const caught = failed.reason;
        setMessage(caught instanceof InvestmentClientError || caught instanceof Error ? caught.message : "Could not load those counts.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Admin</h1>
        <p className="lead">Authentication is connected. These counts are not connected in this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Admin</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Deposit counts come from the pending and verified lists. Active investment figures come from the stored investment list. Pending withdrawals come from stored requests.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <div className="grid-2">
        <CountCard label="Members" count={memberCount} href="/admin/users" link="Users" />
        <CountCard label="Pending deposits" count={pending} href="/admin/deposits" link="Deposits" />
        <CountCard label="Verified deposits" count={verified} href="/admin/deposits" link="Deposits" />
        <CountCard label="Active investments" count={activeCount} href="/admin/investments" link="Investments" />
        <Card>
          <p className="eyebrow">Active total</p>
          <h2>{activeTotal === undefined ? "…" : activeTotal === null ? "Could not total" : formatUsdtAmount(activeTotal, INVESTMENT_SCALE)}</h2>
          <p style={{ marginTop: 10 }}>
            <Link href="/admin/investments">Investments</Link>
          </p>
        </Card>
        <CountCard label="Pending withdrawals" count={pendingWithdrawals} href="/admin/withdrawals" link="Withdrawals" />
      </div>
    </div>
  );
}

function CountCard({ label, count, href, link }: { label: string; count: number | null | undefined; href: string; link: string }) {
  const value = count === undefined ? "…" : count === null ? "Could not count" : String(count);
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <h2>{value}</h2>
      <p style={{ marginTop: 10 }}>
        <Link href={href}>{link}</Link>
      </p>
    </Card>
  );
}

