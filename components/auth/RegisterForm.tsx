"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/auth/PasswordField";
import { Field, Input, Select } from "@/components/ui/Field";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadCurrentUser, loginAccount, logoutAccount, registerAccount } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";
import { PASSWORD_HINT, passwordIssue, TRANSACTION_PASSWORD_MIN } from "@/lib/auth/password";
import { normalizeReferralCode, readPendingReferral, rememberPendingReferral } from "@/lib/auth/referral";
import { canInitializeSubmittedAccount, normalizeSignupEmail, readyAccountStillValid, type ReadyAccount, type SignupPrincipal } from "@/lib/auth/signup-session";
import { rememberPendingSignupProfile, readPendingSignupProfile } from "@/lib/auth/signup-profile";
import { countryNames } from "@/constants/countries";
import { checkReferralCode, initializeCurrentMember, MemberClientError } from "@/lib/members/client";
import fieldStyles from "./AuthFields.module.css";
import styles from "./RegisterForm.module.css";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const readyAccount = useRef<ReadyAccount | null>(null);
  const linkedReferral = normalizeReferralCode(searchParams.get("ref") ?? "");
  const countries = countryNames();

  useEffect(() => {
    if (linkedReferral) {
      setReferralCode(linkedReferral);
    }
  }, [linkedReferral]);

  useEffect(() => {
    const pending = readPendingSignupProfile(window.sessionStorage);
    if (!pending) {
      return;
    }
    setFirstName((current) => current || pending.firstName);
    setLastName((current) => current || pending.lastName);
    setEmail((current) => current || pending.email || "");
    setPhone((current) => current || pending.phone);
    setCountry((current) => current || pending.country || "");
    const savedReferral = readPendingReferral(window.localStorage);
    if (savedReferral) {
      setReferralCode((current) => current || savedReferral);
    }
  }, []);

  useEffect(() => {
    const field = Object.keys(errors)[0];
    if (field) {
      document.getElementById(`${field}-error`)?.scrollIntoView({ block: "center" });
    }
  }, [errors]);

  function collectValidationErrors(form: FormData): Record<string, string> {
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
    return nextErrors;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const nextErrors = collectValidationErrors(form);

    // Any red message means the form is not ready. Do not create a Cognito user or a member record.
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setProgress(null);

    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const transactionPassword = String(form.get("transactionPassword") ?? "");
    const profile = {
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      country: String(form.get("country") ?? "").trim(),
    };

    // Referral is optional. When given, confirm it exists before creating any Cognito account.
    const referral = normalizeReferralCode(String(form.get("referralCode") ?? ""));
    const normalizedEmail = normalizeSignupEmail(email);
    rememberPendingSignupProfile(window.sessionStorage, { ...profile, email: normalizedEmail });
    rememberPendingReferral(window.localStorage, referral);
    const principalBefore = await readSignupPrincipal();
    const sameSession = readyAccountStillValid(readyAccount.current, { email: normalizedEmail, password }, principalBefore);
    if (referral) {
      if (!sameSession) {
        try {
          const check = await checkReferralCode(referral);
          if (!check.valid) {
            setErrors({ referralCode: "That referral code is not valid." });
            setSubmitting(false);
            return;
          }
        } catch (caught) {
          const message =
            caught instanceof MemberClientError ? caught.message : "We could not check your referral code. Please try again.";
          setErrors({ referralCode: message });
          setSubmitting(false);
          return;
        }
      }
    }

    try {
      if (!sameSession) {
        if (principalBefore) {
          await logoutAccount();
        }
        readyAccount.current = null;
        let signedIn = false;
        setProgress("Creating your account…");
        try {
          await registerAccount({ name: `${profile.firstName} ${profile.lastName}`, email: normalizedEmail, password });
        } catch (caught) {
          if (!isUsernameExists(caught)) {
            throw caught;
          }
          setProgress("Signing in to finish your profile…");
          try {
            await loginAccount({ email: normalizedEmail, password, remember: true });
            signedIn = true;
          } catch {
            setErrors({
              password: "An account with this email already exists, and that password did not match. Try again, or log in if you use a different password.",
            });
            setSubmitting(false);
            setProgress(null);
            return;
          }
        }
        if (!signedIn) {
          setProgress("Signing in…");
          await loginAccount({ email: normalizedEmail, password, remember: true });
        }
        const signedInPrincipal = await readSignupPrincipal();
        if (!signedInPrincipal || signedInPrincipal.email !== normalizedEmail || !signedInPrincipal.sub) {
          if (signedInPrincipal) {
            await logoutAccount();
          }
          readyAccount.current = null;
          setErrors({ email: "Sign in with this email before saving the profile." });
          setSubmitting(false);
          setProgress(null);
          return;
        }
        readyAccount.current = { email: normalizedEmail, password, sub: signedInPrincipal.sub };
      }
      const principal = await readSignupPrincipal();
      const ready = readyAccount.current;
      if (!canInitializeSubmittedAccount(ready, principal, normalizedEmail)) {
        readyAccount.current = null;
        if (principal && (!ready || principal.sub !== ready.sub || principal.email !== normalizedEmail)) {
          await logoutAccount();
        }
        setErrors({ email: "Sign in with this email before saving the profile." });
        setSubmitting(false);
        setProgress(null);
        return;
      }
      setProgress("Saving your profile…");
      await initializeCurrentMember(referral, { ...profile, transactionPassword });
      await refresh();
      router.replace("/dashboard");
    } catch (caught) {
      if (caught instanceof MemberClientError) {
        const retry = " Correct it and submit again. A second account will not be created.";
        if (caught.code === "invalid_referral" || caught.code === "self_referral") {
          setErrors({ referralCode: `${caught.message}${retry}` });
        } else if (caught.code === "phone_taken") {
          setErrors({ phone: `${caught.message} Use a different number and submit again.` });
        } else if (caught.code === "email_taken") {
          setErrors({ email: caught.message });
        } else if (/transaction password/i.test(caught.message)) {
          setErrors({ confirmTransactionPassword: caught.message });
        } else if (/mobile|phone/i.test(caught.message)) {
          setErrors({ phone: caught.message });
        } else {
          setErrors({ email: caught.message });
        }
      } else {
        const message = mapAuthError(caught);
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
      }
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className={styles.names}>
        <Field label="First name" htmlFor="firstName" error={errors.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required disabled={submitting} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required disabled={submitting} value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </Field>
      </div>
      <Field label="Email Address" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required disabled={submitting} value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field label="Mobile number" htmlFor="phone" error={errors.phone}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required disabled={submitting} value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <Field label="Country" htmlFor="country" error={errors.country}>
        <Select id="country" name="country" autoComplete="country-name" required disabled={submitting} value={country} onChange={(event) => setCountry(event.target.value)}>
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
      <Field label="Transaction password" htmlFor="transactionPassword" hint="Used only to confirm a withdrawal. Not your login password.">
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
      <Field
        label="Referral Code — Optional"
        htmlFor="referralCode"
        error={errors.referralCode}
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
      {progress ? (
        <p role="status">{progress}</p>
      ) : null}
      <Button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? progress ?? "Please wait…" : "Create Account"}
      </Button>
      <p>
        Already have an account? <Link className={fieldStyles.accountLink} href="/login">Login</Link>
      </p>
    </form>
  );
}

function isUsernameExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "name" in error && (error as { name?: unknown }).name === "UsernameExistsException");
}

async function readSignupPrincipal(): Promise<SignupPrincipal | null> {
  const current = await loadCurrentUser();
  const sub = typeof current?.payload?.sub === "string" ? current.payload.sub : "";
  const email = typeof current?.payload?.email === "string" ? current.payload.email : current?.email ?? "";
  if (!sub || !email.includes("@")) {
    return null;
  }
  return { sub, email: normalizeSignupEmail(email) };
}
