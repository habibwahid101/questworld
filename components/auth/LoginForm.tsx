"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function LoginForm() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit">Log in</Button>
      <p>
        <Link href="/forgot-password">Forgot password?</Link>
      </p>
      <p>
        Need an account? <Link href="/register">Register</Link>
      </p>
    </form>
  );
}
