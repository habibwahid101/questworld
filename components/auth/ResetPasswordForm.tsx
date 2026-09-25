"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { confirmPasswordReset } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";
import { passwordIssue } from "@/lib/auth/password";
import { RESET_EMAIL_KEY } from "@/lib/auth/referral";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    if (!email.trim()) {
      setError("Enter the email address for the account.");
      return;
    }
    if (!code) {
      setError("Enter the reset code from your email.");
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

    setSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset({ email, code, password });
      window.sessionStorage.removeItem(RESET_EMAIL_KEY);
      setUpdated(true);
    } catch (caught) {
      setError(mapAuthError(caught));
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
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <Field label="Email Address" htmlFor="email">
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
      <Field label="New Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={submitting}
        />
      </Field>
      <Field label="Confirm New Password" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
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
