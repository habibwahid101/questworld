"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { changeLoginPassword } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";
import { PASSWORD_HINT, passwordIssue } from "@/lib/auth/password";
import { setCurrentTransactionPassword as saveTransactionPassword } from "@/lib/members/client";
import { memberReferralUrl } from "@/lib/members/referral-url";
import { useMemberData } from "@/components/member/MemberData";
import styles from "./ProfilePanel.module.css";

export function ProfilePanel() {
  const { status, member, message, saveProfile } = useMemberData();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [currentLoginPassword, setCurrentLoginPassword] = useState("");
  const [nextLoginPassword, setNextLoginPassword] = useState("");
  const [confirmLoginPassword, setConfirmLoginPassword] = useState("");
  const [currentTransactionPassword, setCurrentTransactionPassword] = useState("");
  const [nextTransactionPassword, setNextTransactionPassword] = useState("");
  const [confirmTransactionPassword, setConfirmTransactionPassword] = useState("");
  const [transactionPasswordSet, setTransactionPasswordSet] = useState(false);
  const [changingLogin, setChangingLogin] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);

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
    setTransactionPasswordSet(member.transactionPasswordSet);
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

  async function onChangeLoginPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changingLogin) {
      return;
    }
    const issue = passwordIssue(nextLoginPassword);
    if (issue) {
      setNotice(issue);
      return;
    }
    if (nextLoginPassword !== confirmLoginPassword) {
      setNotice("Passwords do not match.");
      return;
    }
    setChangingLogin(true);
    setNotice(null);
    try {
      await changeLoginPassword({ currentPassword: currentLoginPassword, nextPassword: nextLoginPassword });
      setCurrentLoginPassword("");
      setNextLoginPassword("");
      setConfirmLoginPassword("");
      setNotice("Login password changed.");
    } catch (caught) {
      setNotice(mapAuthError(caught));
    } finally {
      setChangingLogin(false);
    }
  }

  async function onSaveTransactionPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingTransaction) {
      return;
    }
    const issue = passwordIssue(nextTransactionPassword);
    if (issue) {
      setNotice(issue);
      return;
    }
    if (nextTransactionPassword !== confirmTransactionPassword) {
      setNotice("Passwords do not match.");
      return;
    }
    setSavingTransaction(true);
    setNotice(null);
    try {
      const next = await saveTransactionPassword({
        transactionPassword: nextTransactionPassword,
        currentTransactionPassword: transactionPasswordSet ? currentTransactionPassword : undefined,
      });
      setTransactionPasswordSet(next.transactionPasswordSet);
      setCurrentTransactionPassword("");
      setNextTransactionPassword("");
      setConfirmTransactionPassword("");
      setNotice("Transaction password saved.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not save the transaction password.");
    } finally {
      setSavingTransaction(false);
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
        <form className="stack" onSubmit={onChangeLoginPassword}>
          <div>
            <h2>Login password</h2>
            <p>Change the password you use to sign in. This does not change an existing password until you submit it.</p>
          </div>
          <Field label="Current password" htmlFor="current-login-password">
            <PasswordField
              id="current-login-password"
              autoComplete="current-password"
              value={currentLoginPassword}
              onChange={(event) => setCurrentLoginPassword(event.target.value)}
              required
              disabled={changingLogin}
            />
          </Field>
          <Field label="New password" htmlFor="next-login-password" hint={PASSWORD_HINT}>
            <PasswordField
              id="next-login-password"
              autoComplete="new-password"
              value={nextLoginPassword}
              onChange={(event) => setNextLoginPassword(event.target.value)}
              required
              disabled={changingLogin}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-login-password">
            <PasswordField
              id="confirm-login-password"
              autoComplete="new-password"
              value={confirmLoginPassword}
              onChange={(event) => setConfirmLoginPassword(event.target.value)}
              required
              disabled={changingLogin}
            />
          </Field>
          <Button type="submit" disabled={changingLogin}>
            {changingLogin ? "Saving…" : "Change login password"}
          </Button>
        </form>
        <form className="stack" onSubmit={onSaveTransactionPassword}>
          <div>
            <h2>Transaction password</h2>
            <p>Used only to confirm a withdrawal. This is not your login password.</p>
          </div>
          {transactionPasswordSet ? (
            <Field label="Current transaction password" htmlFor="current-transaction-password">
              <PasswordField
                id="current-transaction-password"
                autoComplete="off"
                value={currentTransactionPassword}
                onChange={(event) => setCurrentTransactionPassword(event.target.value)}
                required
                disabled={savingTransaction}
              />
            </Field>
          ) : null}
          <Field label="Transaction password" htmlFor="next-transaction-password">
            <PasswordField
              id="next-transaction-password"
              autoComplete="new-password"
              value={nextTransactionPassword}
              onChange={(event) => setNextTransactionPassword(event.target.value)}
              required
              disabled={savingTransaction}
            />
          </Field>
          <Field label="Confirm transaction password" htmlFor="confirm-transaction-password">
            <PasswordField
              id="confirm-transaction-password"
              autoComplete="new-password"
              value={confirmTransactionPassword}
              onChange={(event) => setConfirmTransactionPassword(event.target.value)}
              required
              disabled={savingTransaction}
            />
          </Field>
          <Button type="submit" disabled={savingTransaction}>
            {savingTransaction ? "Saving…" : "Save transaction password"}
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
