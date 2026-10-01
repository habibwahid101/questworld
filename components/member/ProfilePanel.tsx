"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { useMemberData } from "@/components/member/MemberData";
import { memberReferralUrl } from "@/lib/members/service";
import styles from "./ProfilePanel.module.css";

export function ProfilePanel() {
  const { status, member, message, saveProfile } = useMemberData();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!member) {
      return;
    }
    setName(member.name);
    setPhone(member.phone ?? "");
    setCountry(member.country ?? "");
  }, [member]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await saveProfile({ name, phone, country });
      setNotice("Profile saved.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    if (!member) {
      return;
    }
    await navigator.clipboard.writeText(member.referralCode);
    setNotice("Referral code copied.");
  }

  if (status === "unconfigured") {
    return (
      <Card>
        <h1>Profile</h1>
        <p className="lead">Authentication is connected. Member profile storage is not configured for this build yet.</p>
      </Card>
    );
  }

  if (status === "loading" || !member) {
    return (
      <Card>
        <h1>Profile</h1>
        <p>{message ?? "Loading your profile…"}</p>
      </Card>
    );
  }

  const referralLink = origin ? memberReferralUrl(origin, member.referralCode) : "";

  return (
    <Card>
      <div className="stack">
        <div>
          <h1>Profile</h1>
          <p className="lead">Your account details and referral code.</p>
        </div>
        {notice ? <p role="status">{notice}</p> : null}
        <form className="stack" onSubmit={onSubmit}>
          <Field label="Email" htmlFor="profile-email">
            <Input id="profile-email" value={member.email} readOnly />
          </Field>
          <Field label="Name" htmlFor="profile-name">
            <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
          </Field>
          <Field label="Phone" htmlFor="profile-phone" hint="Optional">
            <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} />
          </Field>
          <Field label="Country" htmlFor="profile-country" hint="Optional">
            <Input id="profile-country" value={country} onChange={(event) => setCountry(event.target.value)} maxLength={56} />
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
        <div className={styles.referral}>
          <p>
            Referral code <strong>{member.referralCode}</strong>
          </p>
          <Button variant="secondary" onClick={() => void copyCode()}>
            Copy referral code
          </Button>
          {referralLink ? (
            <p>
              Referral link <span className={styles.link}>{referralLink}</span>
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
