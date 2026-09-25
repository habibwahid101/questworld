import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      title="Reset password"
      description="Password update is a UI placeholder until authentication is connected."
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}
