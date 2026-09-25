"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { requestPasswordReset } from "@/lib/auth/cognito";
import { mapRecoveryRequestError } from "@/lib/auth/errors";
import { RESET_EMAIL_KEY } from "@/lib/auth/referral";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      window.sessionStorage.setItem(RESET_EMAIL_KEY, email.toLowerCase());
      setSubmitted(true);
    } catch (caught) {
      const mapped = mapRecoveryRequestError(caught);
      if (mapped) {
        setError(mapped);
        setSubmitting(false);
        return;
      }
      window.sessionStorage.setItem(RESET_EMAIL_KEY, email.toLowerCase());
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="stack">
        <p role="status">
          If this email belongs to an account, password reset instructions will be sent.
        </p>
        <Link href="/reset-password">Enter reset code</Link>
        <Link href="/login">Return to Login</Link>
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
      <Field label="Registered Email Address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required disabled={submitting} />
      </Field>
      <Button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? "Please wait…" : "Send Reset Link"}
      </Button>
      <p>
        <Link href="/login">Back to Login</Link>
      </p>
    </form>
  );
}
