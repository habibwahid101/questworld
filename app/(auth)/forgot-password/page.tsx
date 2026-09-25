import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Forgot password"
      description="This form is prepared for a later Cognito reset flow."
    >
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
