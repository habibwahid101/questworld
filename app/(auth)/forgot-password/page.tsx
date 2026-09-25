import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Forgot Password",
  "Request a Questra World password reset code.",
  "/forgot-password",
);

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Forgot Password"
      description="Enter your email. If it belongs to an account, a reset code will be sent."
    >
      <ForgotPasswordForm />
    </AuthFrame>
  );
}