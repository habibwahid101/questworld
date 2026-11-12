"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { passwordIssue, TRANSACTION_PASSWORD_MIN } from "@/lib/auth/password";
import { normalizeReferralCode, readPendingReferral, rememberPendingReferral } from "@/lib/auth/referral";
import { readPendingSignupProfile, rememberPendingSignupProfile } from "@/lib/auth/signup-profile";
import { countryNames } from "@/constants/countries";
import { checkReferralCode, initializeCurrentMember, MemberClientError } from "@/lib/members/client";
import type { MemberProfile } from "@/lib/members/service";

export function FinishRegistration({ onComplete }: { onComplete: (member: MemberProfile) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const countries = countryNames();

  useEffect(() => {
    const pending = readPendingSignupProfile(window.sessionStorage);
    if (pending) {
      setFirstName((current) => current || pending.firstName);
      setLastName((current) => current || pending.lastName);
      setPhone((current) => current || pending.phone);
      setCountry((current) => current || pending.country || "");
    }
    const referral = readPendingReferral(window.localStorage);
    if (referral) {
      setReferralCode((current) => current || referral);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const transactionPassword = String(form.get("transactionPassword") ?? "");
    const confirmTransactionPassword = String(form.get("confirmTransactionPassword") ?? "");
    const nextErrors: Record<string, string> = {};
    if (!firstName.trim()) {
      nextErrors.firstName = "Enter your first name.";
    }
    if (!lastName.trim()) {
      nextErrors.lastName = "Enter your last name.";
    }
    if (!/^[0-9+().\-\s]{6,32}$/.test(phone.trim()) || phone.replace(/\D/g, "").length < 6) {
      nextErrors.phone = "Enter a mobile number.";
    }
    if (!country.trim()) {
      nextErrors.country = "Select a country.";
    }
    const transactionIssue = passwordIssue(transactionPassword, TRANSACTION_PASSWORD_MIN);
    if (transactionIssue) {
      nextErrors.confirmTransactionPassword = transactionIssue;
    }
    if (transactionPassword !== confirmTransactionPassword) {
      nextErrors.confirmTransactionPassword = "Transaction passwords do not match.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const profile = { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), country: country.trim() };
    const referral = normalizeReferralCode(referralCode);
    rememberPendingSignupProfile(window.sessionStorage, profile);
    rememberPendingReferral(window.localStorage, referral);
    setSubmitting(true);
    setErrors({});
    setProgress("Checking your details…");

    if (referral) {
      try {
        const check = await checkReferralCode(referral);
        if (!check.valid) {
          setErrors({ referralCode: "That referral code is not valid. Correct it, or clear it and continue without a referral." });
          setSubmitting(false);
          setProgress(null);
          return;
        }
      } catch (caught) {
        const message = caught instanceof MemberClientError ? caught.message : "We could not check your referral code. Please try again.";
        setErrors({ referralCode: message });
        setSubmitting(false);
        setProgress(null);
        return;
      }
    }

    setProgress("Saving your profile…");
    try {
      const member = await initializeCurrentMember(referral, { ...profile, transactionPassword });
      onComplete(member);
    } catch (caught) {
      const error = caught instanceof MemberClientError ? caught : new MemberClientError("member_request_failed", "Could not save your profile. Submit again.");
      if (error.code === "invalid_referral" || error.code === "self_referral") {
        setErrors({ referralCode: `${error.message} Correct it, or clear it and submit again.` });
      } else if (error.code === "phone_taken") {
        setErrors({ phone: `${error.message} Use a different number and submit again.` });
      } else if (error.code === "email_taken") {
        setErrors({ email: error.message });
      } else if (/transaction password/i.test(error.message)) {
        setErrors({ confirmTransactionPassword: error.message });
      } else {
        setErrors({ form: error.message });
      }
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <Card>
      <h1>Finish registration</h1>
      <p className="lead" style={{ marginTop: 12 }}>
        Your login is already created. This step only saves your profile. It does not create another account or any investment.
      </p>
      <form className="stack" onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <Field label="First name" htmlFor="finish-first-name" error={errors.firstName}>
          <Input id="finish-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required disabled={submitting} />
        </Field>
        <Field label="Last name" htmlFor="finish-last-name" error={errors.lastName}>
          <Input id="finish-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required disabled={submitting} />
        </Field>
        <Field label="Mobile number" htmlFor="finish-phone" error={errors.phone}>
          <Input id="finish-phone" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" inputMode="tel" required disabled={submitting} />
        </Field>
        <Field label="Country" htmlFor="finish-country" error={errors.country}>
          <Select id="finish-country" value={country} onChange={(event) => setCountry(event.target.value)} required disabled={submitting}>
            <option value="">Select a country</option>
            {countries.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Transaction password" htmlFor="finish-transaction-password" hint="Used only to confirm a withdrawal. Not your login password.">
          <PasswordField id="finish-transaction-password" name="transactionPassword" autoComplete="new-password" required disabled={submitting} />
        </Field>
        <Field label="Confirm transaction password" htmlFor="finish-confirm-transaction-password" error={errors.confirmTransactionPassword}>
          <PasswordField id="finish-confirm-transaction-password" name="confirmTransactionPassword" autoComplete="new-password" required disabled={submitting} />
        </Field>
        <Field label="Referral Code — Optional" htmlFor="finish-referral" error={errors.referralCode} hint="Leave this blank if you do not have a referral code.">
          <Input id="finish-referral" value={referralCode} onChange={(event) => setReferralCode(event.target.value)} autoComplete="off" disabled={submitting} />
        </Field>
        {errors.form ? (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        ) : null}
        {errors.email ? (
          <p className="form-error" role="alert">
            {errors.email}
          </p>
        ) : null}
        {progress ? <p role="status">{progress}</p> : null}
        <Button type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? progress ?? "Please wait…" : "Save profile"}
        </Button>
      </form>
    </Card>
  );
}
