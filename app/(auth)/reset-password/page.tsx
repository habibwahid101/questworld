import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Reset Password",
  "Reset your Questra World password with the recovery code.",
  "/reset-password",
);

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      title="Reset Password"
      description="Use the recovery code from your email. This is not a signup verification step."
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}