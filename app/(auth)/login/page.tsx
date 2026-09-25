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
      description="Account authentication is UI-only in this version. No session is created."
    >
      <LoginForm />
    </AuthFrame>
  );
}
