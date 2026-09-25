import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <AuthFrame
      title="Log in"
      description="Account authentication is a UI foundation only. No session is created."
    >
      <LoginForm />
    </AuthFrame>
  );
}
