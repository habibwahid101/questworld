import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Create Account",
  "Register for Questra World with an optional referral code.",
  "/register",
);

export default function RegisterPage() {
  return (
    <AuthFrame
      title="Create Account"
      description="Create your account with email and password. No signup email verification step is required."
    >
      <Suspense fallback={<p>Loading registration form…</p>}>
        <RegisterForm />
      </Suspense>
    </AuthFrame>
  );
}