import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Reset Password",
  "Choose a new Questra World password.",
  "/reset-password",
);

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      title="Reset Password"
      description="This screen is a UI placeholder until authentication is connected."
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}
