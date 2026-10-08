"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { InvestmentClientError, listPendingDeposits, listVerifiedDeposits } from "@/lib/investments/client";
import { listStoredMembers } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";

export function AdminOverviewPanel() {
  const [pending, setPending] = useState<number | null>();
  const [verified, setVerified] = useState<number | null>();
  const [memberCount, setMemberCount] = useState<number | null>();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void Promise.allSettled([listPendingDeposits(), listVerifiedDeposits(), listStoredMembers()]).then(([pendingResult, verifiedResult, membersResult]) => {
      if (!active) {
        return;
      }
      setPending(pendingResult.status === "fulfilled" ? pendingResult.value.length : null);
      setVerified(verifiedResult.status === "fulfilled" ? verifiedResult.value.length : null);
      setMemberCount(membersResult.status === "fulfilled" ? membersResult.value.length : null);
      const failed = [pendingResult, verifiedResult, membersResult].find((result) => result.status === "rejected");
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
          Deposit counts come from the pending and verified lists. The member count comes from the stored member list. Withdrawal lists are not available.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <div className="grid-2">
        <CountCard label="Members" count={memberCount} href="/admin/users" link="Users" />
        <CountCard label="Pending deposits" count={pending} href="/admin/deposits" link="Deposits" />
        <CountCard label="Verified deposits" count={verified} href="/admin/deposits" link="Deposits" />
        <UnavailableCard label="Pending withdrawals" detail="There is no pending-withdrawal list to read." href="/admin/withdrawals" link="Withdrawals" />
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

function UnavailableCard({ label, detail, href, link }: { label: string; detail: string; href: string; link: string }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <h2>No list</h2>
      <p style={{ marginTop: 10 }}>{detail}</p>
      <p style={{ marginTop: 10 }}>
        <Link href={href}>{link}</Link>
      </p>
    </Card>
  );
}
