import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { LoginForm } from "@/components/auth/LoginForm";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Login",
  "Log in to your Questra World account.",
  "/login",
);

export default function LoginPage() {
  return (
    <AuthFrame
      title="Login"
      description="Sign in with the email and password for your Questra World account."
    >
      <Suspense fallback={<p>Loading login…</p>}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}