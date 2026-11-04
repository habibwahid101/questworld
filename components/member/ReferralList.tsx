"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { MemberClientError, listMyReferrals } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { ReferralListItem } from "@/lib/members/service";
import styles from "./ReferralList.module.css";

export function ReferralList() {
  const [rows, setRows] = useState<ReferralListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      setLoading(false);
      return;
    }
    let active = true;
    void listMyReferrals()
      .then((items) => {
        if (active) {
          setRows(items);
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
    <Card>
      <h2>My referrals</h2>
      <p className="lead">Members who registered with your referral code.</p>
      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
      {loading ? (
        <p style={{ marginTop: 12 }}>Loading referrals…</p>
      ) : rows.length === 0 ? (
        <p style={{ marginTop: 12 }}>No referrals yet.</p>
      ) : (
        <div className={styles.scroll}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Referral code</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.referralCode}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
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
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
