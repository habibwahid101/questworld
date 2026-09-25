"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function ResetPasswordForm() {
  const [updated, setUpdated] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdated(true);
  }

  if (updated) {
    return (
      <div className="stack">
        <h2>Password Updated Successfully</h2>
        <p>You can continue to the login screen. No password was changed on a server.</p>
        <Button href="/login">Continue to Login</Button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="New Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Confirm New Password" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Button type="submit">Reset Password</Button>
    </form>
  );
}
