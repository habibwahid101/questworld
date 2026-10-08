"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/auth/PasswordField";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/components/auth/AuthProvider";
import { loginAccount, registerAccount } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";
import { PASSWORD_HINT, passwordIssue } from "@/lib/auth/password";
import { normalizeReferralCode, rememberPendingReferral } from "@/lib/auth/referral";
import { rememberPendingSignupProfile } from "@/lib/auth/signup-profile";
import fieldStyles from "./AuthFields.module.css";
import styles from "./RegisterForm.module.css";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const linkedReferral = normalizeReferralCode(searchParams.get("ref") ?? "");

  useEffect(() => {
    if (linkedReferral) {
      setReferralCode(linkedReferral);
    }
  }, [linkedReferral]);

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
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const accepted = form.get("terms") === "on";
    const issue = passwordIssue(password);

    if (!firstName || !lastName || !email) {
      setError("Enter your first name, last name, and email.");
      return;
    }
    if (!/^[0-9+().\-\s]{6,32}$/.test(phone) || phone.replace(/\D/g, "").length < 6) {
      setError("Enter a mobile number.");
      return;
    }
    if (issue) {
      setError(issue);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await registerAccount({ name: `${firstName} ${lastName}`, email, password });
      rememberPendingReferral(window.localStorage, referralCode);
      rememberPendingSignupProfile(window.sessionStorage, { firstName, lastName, phone });
      await loginAccount({ email, password, remember: true });
      await refresh();
      router.replace("/dashboard");
    } catch (caught) {
      setError(mapAuthError(caught));
      setSubmitting(false);
    }
  }

  return (
    <form className={`stack ${fieldStyles.fields}`} onSubmit={onSubmit}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.names}>
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" autoComplete="given-name" required disabled={submitting} />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" autoComplete="family-name" required disabled={submitting} />
        </Field>
      </div>
      <Field label="Email Address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required disabled={submitting} />
      </Field>
      <Field label="Mobile number" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required disabled={submitting} />
      </Field>
      <Field label="Password" htmlFor="password" hint={PASSWORD_HINT}>
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          required
          disabled={submitting}
        />
      </Field>
      <Field label="Confirm Password" htmlFor="confirmPassword">
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          disabled={submitting}
        />
      </Field>
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
      <Button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? "Please wait…" : "Create Account"}
      </Button>
      <p>
        Already have an account? <Link href="/login">Login</Link>
      </p>
    </form>
  );
}
