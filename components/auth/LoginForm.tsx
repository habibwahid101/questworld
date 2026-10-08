"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/auth/PasswordField";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/components/auth/AuthProvider";
import { loginAccount } from "@/lib/auth/cognito";
import { mapAuthError } from "@/lib/auth/errors";

function reasonMessage(reason: string | null): string | null {
  if (reason === "config") {
    return "Authentication is not configured yet.";
  }
  if (reason === "session") {
    return "Your session expired. Sign in again.";
  }
  if (reason === "auth") {
    return "Sign in to continue.";
  }
  return null;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, refresh } = useAuth();
  const [error, setError] = useState<string | null>(reasonMessage(searchParams.get("reason")));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const remember = form.get("remember") === "on";

    setSubmitting(true);
    setError(null);
    try {
      await loginAccount({ email, password, remember });
      await refresh();
      router.replace("/dashboard");
    } catch (caught) {
      setError(mapAuthError(caught));
      setSubmitting(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <Field label="Email Address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required disabled={submitting} />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordField
          id="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={submitting}
        />
      </Field>
      <div className="cluster" style={{ justifyContent: "space-between" }}>
        <label htmlFor="remember" className="cluster">
          <input id="remember" name="remember" type="checkbox" disabled={submitting} />
          <span>Remember Me</span>
        </label>
        <Link href="/forgot-password">Forgot Password?</Link>
      </div>
      <Button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? "Please wait…" : "Login"}
      </Button>
      <p>
        {"Don't have an account?"} <Link href="/register">Create Account</Link>
      </p>
    </form>
  );
}
