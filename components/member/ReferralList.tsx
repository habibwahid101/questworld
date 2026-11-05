"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { MemberClientError, listMyReferrals } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { ReferralListItem } from "@/lib/members/service";
import styles from "./ReferralList.module.css";

export function ReferralList() {
  const [first, setFirst] = useState<ReferralListItem[]>([]);
  const [second, setSecond] = useState<ReferralListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      setLoading(false);
      return;
    }
    let active = true;
    void listMyReferrals()
      .then((result) => {
        if (active) {
          setFirst(result.first);
          setSecond(result.second);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setMessage(caught instanceof MemberClientError ? caught.message : "Could not load your referrals.");
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
  }, []);

  if (!isMemberApiConfigured()) {
    return null;
  }

  return (
    <div className="stack">
      <Card>
        <h2>Referrals</h2>
        <p className="lead">Members who registered with your referral code.</p>
        {message ? <p className="notice notice-error" style={{ marginTop: 12 }}>{message}</p> : null}
        {loading ? <p style={{ marginTop: 12 }}>Loading…</p> : null}
      </Card>
      <GenerationTable title="1st Generation" rows={first} loading={loading} empty="No 1st generation referrals yet." />
      <GenerationTable title="2nd Generation" rows={second} loading={loading} empty="No 2nd generation referrals yet." />
    </div>
  );
}

function GenerationTable({ title, rows, loading, empty }: { title: string; rows: ReferralListItem[]; loading: boolean; empty: string }) {
  if (loading) {
    return null;
  }
  return (
    <Card>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="lead" style={{ marginTop: 8 }}>{empty}</p>
      ) : (
        <div className={styles.scroll}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Referral code</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.referralCode}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.phone ?? "—"}</td>
                  <td>{row.referralCode}</td>
                  <td>{formatJoined(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function formatJoined(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
