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
    <form className="stack" onSubmit={onSubmit} noValidate={false}>
      <Field label="Email Address" htmlFor="email">
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
      <div className="cluster" style={{ justifyContent: "space-between" }}>
        <label htmlFor="remember" className="cluster">
          <input id="remember" name="remember" type="checkbox" />
          <span>Remember Me</span>
        </label>
        <Link href="/forgot-password">Forgot Password?</Link>
      </div>
      <Button type="submit">Login</Button>
      <p>
        {"Don't have an account?"} <Link href="/register">Create Account</Link>
      </p>
    </form>
  );
}
