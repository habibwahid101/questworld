"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/auth/PasswordField";
import { Field, Input, Select } from "@/components/ui/Field";
import { useAuth } from "@/components/auth/AuthProvider";
import { loginAccount, registerAccount } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";
import { PASSWORD_HINT, passwordIssue, TRANSACTION_PASSWORD_MIN } from "@/lib/auth/password";
import { normalizeReferralCode, rememberPendingReferral } from "@/lib/auth/referral";
import { rememberPendingSignupProfile } from "@/lib/auth/signup-profile";
import { countryNames } from "@/constants/countries";
import { initializeCurrentMember, MemberClientError } from "@/lib/members/client";
import fieldStyles from "./AuthFields.module.css";
import styles from "./RegisterForm.module.css";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const linkedReferral = normalizeReferralCode(searchParams.get("ref") ?? "");
  const countries = countryNames();

  useEffect(() => {
    if (linkedReferral) {
      setReferralCode(linkedReferral);
    }
  }, [linkedReferral]);

  useEffect(() => {
    const field = Object.keys(errors)[0];
    if (field) {
      document.getElementById(`${field}-error`)?.scrollIntoView({ block: "center" });
    }
  }, [errors]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const country = String(form.get("country") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const transactionPassword = String(form.get("transactionPassword") ?? "");
    const confirmTransactionPassword = String(form.get("confirmTransactionPassword") ?? "");
    const accepted = form.get("terms") === "on";
    const issue = passwordIssue(password);
    const transactionIssue = passwordIssue(transactionPassword, TRANSACTION_PASSWORD_MIN);
    const nextErrors: Record<string, string> = {};

    if (!firstName) {
      nextErrors.firstName = "Enter your first name.";
    }
    if (!lastName) {
      nextErrors.lastName = "Enter your last name.";
    }
    if (!email) {
      nextErrors.email = "Enter your email.";
    }
    if (!/^[0-9+().\-\s]{6,32}$/.test(phone) || phone.replace(/\D/g, "").length < 6) {
      nextErrors.phone = "Enter a mobile number.";
    }
    if (!country) {
      nextErrors.country = "Select a country.";
    }
    if (issue) {
      nextErrors.password = issue;
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (transactionIssue) {
      nextErrors.confirmTransactionPassword = transactionIssue;
    }
    if (transactionPassword !== confirmTransactionPassword) {
      nextErrors.confirmTransactionPassword = "Transaction passwords do not match.";
    }
    if (transactionPassword === password && transactionPassword.length > 0) {
      nextErrors.confirmTransactionPassword = "Use a transaction password that is not your login password.";
    }
    if (!accepted) {
      nextErrors.terms = "Accept the Terms & Conditions and Privacy Policy to continue.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      await registerAccount({ name: `${firstName} ${lastName}`, email, password });
      rememberPendingReferral(window.localStorage, referralCode);
      rememberPendingSignupProfile(window.sessionStorage, { firstName, lastName, phone, country });
      await loginAccount({ email, password, remember: true });
      await initializeCurrentMember(referralCode, { firstName, lastName, phone, country, transactionPassword });
      await refresh();
      router.replace("/dashboard");
    } catch (caught) {
      const message = caught instanceof MemberClientError ? caught.message : mapAuthError(caught);
      if (/already exists/i.test(message)) {
        setErrors({ email: message });
      } else if (/transaction password/i.test(message)) {
        setErrors({ confirmTransactionPassword: message });
      } else if (/password/i.test(message)) {
        setErrors({ confirmPassword: message });
      } else if (/mobile|phone/i.test(message)) {
        setErrors({ phone: message });
      } else {
        setErrors({ email: message });
      }
      setSubmitting(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className={styles.names}>
        <Field label="First name" htmlFor="firstName" error={errors.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required disabled={submitting} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required disabled={submitting} />
        </Field>
      </div>
      <Field label="Email Address" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required disabled={submitting} />
      </Field>
      <Field label="Mobile number" htmlFor="phone" error={errors.phone}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required disabled={submitting} />
      </Field>
      <Field label="Country" htmlFor="country" error={errors.country}>
        <Select id="country" name="country" autoComplete="country-name" required disabled={submitting} defaultValue="">
          <option value="">Select a country</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Password" htmlFor="password" hint={PASSWORD_HINT} error={errors.password}>
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          required
          disabled={submitting}
        />
      </Field>
      <Field label="Confirm Password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          disabled={submitting}
        />
      </Field>
      <section className={styles.transactionSection} aria-labelledby="transaction-password-heading">
        <div>
          <h2 id="transaction-password-heading" className={styles.transactionHeading}>Transaction password</h2>
          <p className={styles.transactionNote}>Used only to confirm a withdrawal. Not your login password.</p>
        </div>
        <Field label="Transaction password" htmlFor="transactionPassword">
          <PasswordField
            id="transactionPassword"
            name="transactionPassword"
            autoComplete="new-password"
            required
            disabled={submitting}
          />
        </Field>
        <Field label="Confirm transaction password" htmlFor="confirmTransactionPassword" error={errors.confirmTransactionPassword}>
          <PasswordField
            id="confirmTransactionPassword"
            name="confirmTransactionPassword"
            autoComplete="new-password"
            required
            disabled={submitting}
          />
        </Field>
      </section>
      <Field
        label="Referral Code — Optional"
        htmlFor="referralCode"
        hint={linkedReferral ? "Referral code filled from the link you used." : undefined}
      >
        <Input
          id="referralCode"
          name="referralCode"
          autoComplete="off"
          value={referralCode}
          disabled={submitting}
          onChange={(event) => setReferralCode(event.target.value)}
        />
      </Field>
      <label htmlFor="terms" className="cluster">
        <input id="terms" name="terms" type="checkbox" required disabled={submitting} />
        <span>
          I agree to the <Link href="/terms">Terms & Conditions</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>
      {errors.terms ? (
        <p className="form-error" role="alert">
          {errors.terms}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? "Please wait…" : "Create Account"}
      </Button>
      <p>
        Already have an account? <Link className={fieldStyles.accountLink} href="/login">Login</Link>
      </p>
    </form>
  );
}
