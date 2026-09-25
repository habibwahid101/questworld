import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Forgot Password",
  "Request a Questra World password reset link.",
  "/forgot-password",
);

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Forgot Password"
      description="No email is sent in this version. The confirmation wording is ready for a later reset flow."
    >
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
