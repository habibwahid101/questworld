"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { changeMemberAdminGroup, InvestmentClientError } from "@/lib/investments/client";

export function AdminUsersPanel() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<"grant" | "remove" | null>(null);

  async function submit(action: "grant" | "remove") {
    if (saving) {
      return;
    }
    setSaving(action);
    setMessage(null);
    try {
      const result = await changeMemberAdminGroup(email.trim(), action);
      setMessage(result.message);
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not change that administrator group.");
      setMessage(error.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <h1>Users</h1>
      <p className="lead" style={{ marginTop: 12 }}>
        Grant or remove the Admins group for another member. This does not change your own group. The member must log in again before the change takes effect.
      </p>
      <label htmlFor="member-email">Member email</label>
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
  );
}
