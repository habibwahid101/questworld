"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { changeMemberAdminGroup, InvestmentClientError } from "@/lib/investments/client";
import { listStoredMembers, MemberClientError } from "@/lib/members/client";
import type { ListedMember } from "@/lib/members/service";
import { isMemberApiConfigured } from "@/lib/members/config";

export function AdminUsersPanel() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<"grant" | "remove" | null>(null);
  const [members, setMembers] = useState<ListedMember[] | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMembers(await listStoredMembers());
    setListMessage(null);
  }, []);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      setMembers([]);
      setListMessage("Member profiles are not connected in this build.");
      return;
    }
    let active = true;
    void load().catch((caught: unknown) => {
      if (!active) {
        return;
      }
      const error = caught instanceof MemberClientError ? caught : new MemberClientError("member_request_failed", "Could not load members.");
      setListMessage(error.message);
      setMembers(null);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function submit(action: "grant" | "remove") {
    if (saving) {
      return;
    }
    setSaving(action);
    setMessage(null);
    try {
      const result = await changeMemberAdminGroup(email.trim(), action);
      setMessage(result.message);
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not change that administrator group.");
      setMessage(error.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="stack">
      <Card>
        <h1>Users</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Stored members are listed here. Grant or remove the Admins group for another member. This does not delete an account, and it does not change your own group. The member must log in again before the change takes effect.
        </p>
        {listMessage ? <p style={{ marginTop: 16 }}>{listMessage}</p> : null}
        {members === null ? (
          <p style={{ marginTop: 16 }}>Loading members…</p>
        ) : members.length === 0 ? (
          <p style={{ marginTop: 16 }}>No stored members.</p>
        ) : (
          <div className="stack" style={{ marginTop: 16 }}>
            {members.map((member) => (
              <Card key={`${member.email}:${member.referralCode}`}>
                <p className="eyebrow">{member.role}</p>
                <h2>{member.name}</h2>
                <p style={{ marginTop: 10 }}>{member.email}</p>
                <p>Referral code {member.referralCode}</p>
                <p>Joined {new Date(member.createdAt).toLocaleString()}</p>
                {member.sponsorReferralCode ? <p>Sponsor {member.sponsorReferralCode}</p> : null}
              </Card>
            ))}
          </div>
        )}
        <label htmlFor="member-email" style={{ display: "block", marginTop: 16 }}>Member email</label>
        <input
          id="member-email"
          type="email"
          value={email}
          autoComplete="off"
          onChange={(event) => setEmail(event.target.value)}
          style={{ display: "block", width: "100%", marginTop: 8 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Button disabled={saving !== null} onClick={() => void submit("grant")}>
            {saving === "grant" ? "Saving…" : "Grant admin"}
          </Button>
          <Button variant="secondary" disabled={saving !== null} onClick={() => void submit("remove")}>
            {saving === "remove" ? "Saving…" : "Remove admin"}
          </Button>
        </div>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
    </div>
  );
}
