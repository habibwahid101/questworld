"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function RegisterForm() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Referral code (optional)" htmlFor="referralCode">
        <Input id="referralCode" name="referralCode" autoComplete="off" />
      </Field>
      <label htmlFor="terms" className="cluster">
        <input id="terms" name="terms" type="checkbox" required />
        <span>I accept the terms presented for account registration.</span>
      </label>
      <Button type="submit">Create account</Button>
      <p>
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
