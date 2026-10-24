"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/auth/PasswordField";
import { Field, Input } from "@/components/ui/Field";
import { confirmPasswordReset } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";
import { PASSWORD_HINT, passwordIssue } from "@/lib/auth/password";
import { RESET_EMAIL_KEY } from "@/lib/auth/referral";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [updated, setUpdated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(RESET_EMAIL_KEY);
    if (stored) {
      setEmail(stored);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const issue = passwordIssue(password);

    const nextErrors: Record<string, string> = {};
    if (!email.trim()) {
      nextErrors.email = "Enter the email address for the account.";
    }
    if (!code) {
      nextErrors.code = "Enter the reset code from your email.";
    }
    if (issue) {
      nextErrors.password = issue;
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      await confirmPasswordReset({ email, code, password });
      window.sessionStorage.removeItem(RESET_EMAIL_KEY);
      setUpdated(true);
    } catch (caught) {
      const message = mapAuthError(caught);
      if (/code/i.test(message)) {
        setFieldErrors({ code: message });
      } else if (/password/i.test(message)) {
        setFieldErrors({ confirmPassword: message });
      } else {
        setFieldErrors({ email: message });
      }
      setSubmitting(false);
    }
  }

  if (updated) {
    return (
      <div className="stack">
        <h2>Password Updated Successfully</h2>
        <p role="status">You can now sign in with the new password.</p>
        <Button href="/login">Continue to Login</Button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="Email Address" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field
        label="Reset code"
        htmlFor="code"
        hint="This code is for password recovery only. Signup does not ask for an email code."
        error={fieldErrors.code}
      >
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          disabled={submitting}
        />
      </Field>
      <Field label="New Password" htmlFor="password" hint={PASSWORD_HINT} error={fieldErrors.password}>
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          required
          disabled={submitting}
        />
      </Field>
      <Field label="Confirm New Password" htmlFor="confirmPassword" error={fieldErrors.confirmPassword}>
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          disabled={submitting}
        />
      </Field>
      <Button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? "Please wait…" : "Reset Password"}
      </Button>
    </form>
  );
}
