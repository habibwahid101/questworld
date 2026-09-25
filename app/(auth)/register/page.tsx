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
      description="Registration collects the fields below. No email verification step is included."
    >
      <Suspense fallback={<p>Loading registration form…</p>}>
        <RegisterForm />
      </Suspense>
    </AuthFrame>
  );
}
