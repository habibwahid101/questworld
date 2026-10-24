"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { changeLoginPassword } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";
import { PASSWORD_HINT, passwordIssue, TRANSACTION_PASSWORD_MIN } from "@/lib/auth/password";
import { setCurrentTransactionPassword as saveTransactionPassword, readCurrentMember, readCurrentProfilePhoto, uploadCurrentProfilePhoto } from "@/lib/members/client";
import { memberReferralUrl } from "@/lib/members/referral-url";
import { useMemberData } from "@/components/member/MemberData";
import { ProfilePhoto } from "@/components/member/ProfilePhoto";
import type { MemberProfile } from "@/lib/members/service";
import styles from "./ProfilePanel.module.css";

export function ProfilePanel() {
  const { status, member, message, saveProfile } = useMemberData();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [loginField, setLoginField] = useState<string | null>(null);
  const [loginFieldError, setLoginFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileFieldError, setProfileFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [currentLoginPassword, setCurrentLoginPassword] = useState("");
  const [nextLoginPassword, setNextLoginPassword] = useState("");
  const [confirmLoginPassword, setConfirmLoginPassword] = useState("");
  const [currentTransactionPassword, setCurrentTransactionPassword] = useState("");
  const [nextTransactionPassword, setNextTransactionPassword] = useState("");
  const [confirmTransactionPassword, setConfirmTransactionPassword] = useState("");
  const [transactionPasswordSet, setTransactionPasswordSet] = useState(false);
  const [transactionNotice, setTransactionNotice] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [changingLogin, setChangingLogin] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [readMember, setReadMember] = useState<MemberProfile | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const shownMember = readMember ?? member;

  useEffect(() => {
    if (!shownMember?.hasProfilePhoto) {
      return;
    }
    let active = true;
    void readCurrentProfilePhoto()
      .then((photo) => {
        if (active && photo) {
          setPhotoUrl(`data:${photo.contentType};base64,${photo.dataBase64}`);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [shownMember?.hasProfilePhoto, shownMember?.userId]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    void readCurrentMember()
      .then((profile) => {
        if (active) {
          setReadMember(profile);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
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
    setProfileFieldError(null);
    try {
      await saveProfile({ name, phone, country });
      setNotice("Profile saved.");
    } catch (caught) {
      setProfileFieldError(caught instanceof Error ? caught.message : "Could not save your profile.");
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
      setLoginField("next");
      setLoginFieldError(issue);
      return;
    }
    if (nextLoginPassword !== confirmLoginPassword) {
      setLoginField("confirm");
      setLoginFieldError("Passwords do not match.");
      return;
    }
    setChangingLogin(true);
    setNotice(null);
    setLoginField(null);
    setLoginFieldError(null);
    try {
      await changeLoginPassword({ currentPassword: currentLoginPassword, nextPassword: nextLoginPassword });
      setCurrentLoginPassword("");
      setNextLoginPassword("");
      setConfirmLoginPassword("");
      setNotice("Login password changed.");
    } catch (caught) {
      const message = mapAuthError(caught);
      setLoginField(/current|incorrect/i.test(message) ? "current" : "confirm");
      setLoginFieldError(message);
    } finally {
      setChangingLogin(false);
    }
  }

  async function onSaveTransactionPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingTransaction) {
      return;
    }
    const issue = passwordIssue(nextTransactionPassword, TRANSACTION_PASSWORD_MIN);
    if (issue) {
      setTransactionError(issue);
      setTransactionNotice(null);
      return;
    }
    if (nextTransactionPassword !== confirmTransactionPassword) {
      setTransactionError("Passwords do not match.");
      setTransactionNotice(null);
      return;
    }
    setSavingTransaction(true);
    setNotice(null);
    setTransactionError(null);
    setTransactionNotice(null);
    try {
      const next = await saveTransactionPassword({
        transactionPassword: nextTransactionPassword,
        currentTransactionPassword: transactionPasswordSet ? currentTransactionPassword : undefined,
      });
      setTransactionPasswordSet(next.transactionPasswordSet);
      setCurrentTransactionPassword("");
      setNextTransactionPassword("");
      setConfirmTransactionPassword("");
      setTransactionNotice("Transaction password saved.");
    } catch (caught) {
      setTransactionError(caught instanceof Error ? caught.message : "Could not save the transaction password.");
    } finally {
      setSavingTransaction(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function onPhoto(file: File) {
    if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
      setPhotoError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > 1_500_000) {
      setPhotoError("Use a JPEG, PNG, or WebP image under 1.5 MB.");
      return;
    }
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadCurrentProfilePhoto({ contentType: file.type, dataBase64 });
      setPhotoUrl(`data:${file.type};base64,${dataBase64}`);
    } catch (caught) {
      setPhotoError(caught instanceof Error ? caught.message : "Could not save that profile photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }
  async function copyCode() {
    const code = (readMember ?? member)?.referralCode ?? "";
    if (!code) {
      return;
    }
    await copyValue("code", code);
  }

  async function copyLink() {
    const code = (readMember ?? member)?.referralCode ?? "";
    if (!code || !origin) {
      return;
    }
    await copyValue("link", memberReferralUrl(origin, code));
  }

  async function copyValue(kind: "code" | "link", value: string) {
    const copiedOk = await writeClipboard(value);
    if (!copiedOk) {
      return;
    }
    setCopied(kind);
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
    }
    copyTimer.current = window.setTimeout(() => {
      setCopied((current) => (current === kind ? null : current));
    }, 2000);
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

  const referralLink = origin ? memberReferralUrl(origin, (readMember ?? member).referralCode) : "";
  const shown = readMember ?? member;

  return (
    <Card>
      <div className="stack">
        <div>
          <ProfilePhoto
            name={shown.name}
            src={photoUrl}
            editable
            uploading={uploadingPhoto}
            onSelect={(file) => void onPhoto(file)}
          >
            <h1>Profile</h1>
            <p className="lead">Your account details and referral code.</p>
            <p>Name {shown.name}</p>
            <p>Email {shown.email}</p>
            <p>
              Referral code <strong>{shown.referralCode}</strong>
            </p>
          </ProfilePhoto>
          {photoError ? (
            <p className="form-error" role="alert">
              {photoError}
            </p>
          ) : null}
        </div>
        <form className={styles.passwordSection} id="transaction-password" onSubmit={onSaveTransactionPassword}>
          <div>
            <h2>Transaction password</h2>
            <p>Used only to confirm withdrawals.</p>
          </div>
          {transactionNotice ? (
            <p className={styles.saved} role="status">
              {transactionNotice}
            </p>
          ) : null}
          {transactionPasswordSet ? (
            <Field label="Current transaction password" htmlFor="current-transaction-password" error={transactionError && /current|not correct/i.test(transactionError) ? transactionError : null}>
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
          <Field label="Confirm transaction password" htmlFor="confirm-transaction-password" error={transactionError && !/current|not correct/i.test(transactionError) ? transactionError : null}>
            <PasswordField
              id="confirm-transaction-password"
              autoComplete="new-password"
              value={confirmTransactionPassword}
              onChange={(event) => setConfirmTransactionPassword(event.target.value)}
              required
              disabled={savingTransaction}
            />
          </Field>
          <Button type="submit" disabled={savingTransaction} aria-busy={savingTransaction}>
            {savingTransaction ? "Saving…" : "Save transaction password"}
          </Button>
        </form>
        {notice ? <p role="status">{notice}</p> : null}
        <form className="stack" onSubmit={onSubmit}>
          <Field label="Email" htmlFor="profile-email">
            <Input id="profile-email" value={shown.email} readOnly />
          </Field>
          <Field label="Name" htmlFor="profile-name" error={profileFieldError}>
            <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
          </Field>
          <Field label="Phone" htmlFor="profile-phone" hint="Optional">
            <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} />
          </Field>
          <Field label="Country" htmlFor="profile-country" hint="Optional">
            <Input id="profile-country" value={country} onChange={(event) => setCountry(event.target.value)} maxLength={56} />
          </Field>
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
        <form className="stack" onSubmit={onChangeLoginPassword}>
          <div>
            <h2>Login password</h2>
            <p>Change the password you use to sign in. This does not change an existing password until you submit it.</p>
          </div>
          <Field label="Current password" htmlFor="current-login-password" error={loginField === "current" ? loginFieldError : null}>
            <PasswordField
              id="current-login-password"
              autoComplete="current-password"
              value={currentLoginPassword}
              onChange={(event) => setCurrentLoginPassword(event.target.value)}
              required
              disabled={changingLogin}
            />
          </Field>
          <Field label="New password" htmlFor="next-login-password" hint={PASSWORD_HINT} error={loginField === "next" ? loginFieldError : null}>
            <PasswordField
              id="next-login-password"
              autoComplete="new-password"
              value={nextLoginPassword}
              onChange={(event) => setNextLoginPassword(event.target.value)}
              required
              disabled={changingLogin}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-login-password" error={loginField === "confirm" ? loginFieldError : null}>
            <PasswordField
              id="confirm-login-password"
              autoComplete="new-password"
              value={confirmLoginPassword}
              onChange={(event) => setConfirmLoginPassword(event.target.value)}
              required
              disabled={changingLogin}
            />
          </Field>
          <Button type="submit" disabled={changingLogin} aria-busy={changingLogin}>
            {changingLogin ? "Saving…" : "Change login password"}
          </Button>
        </form>
        <div className={styles.referral}>
          <p>
            Referral code <strong>{shown.referralCode}</strong>
          </p>
          <Button variant="secondary" onClick={() => void copyCode()}>
            {copied === "code" ? "Copied" : "Copy referral code"}
          </Button>
          {referralLink ? (
            <p>
              Referral link <span className={styles.link}>{referralLink}</span>
            </p>
          ) : null}
          <Button variant="secondary" onClick={() => void copyLink()} disabled={!referralLink}>
            {copied === "link" ? "Copied" : "Copy referral link"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const copiedOk = document.execCommand("copy");
    area.remove();
    return copiedOk;
  }
}
