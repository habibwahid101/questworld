"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="stack">
        <p>
          If this email belongs to an account, password reset instructions will be sent.
        </p>
        <Link href="/login">Return to Login</Link>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="Registered Email Address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit">Send Reset Link</Button>
      <p>
        <Link href="/login">Back to Login</Link>
      </p>
    </form>
  );
}
