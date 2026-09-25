"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function ForgotPasswordForm() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="Email" htmlFor="email" hint="No reset email is sent in this foundation.">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit">Continue</Button>
      <p>
        <Link href="/login">Back to login</Link>
      </p>
    </form>
  );
}
