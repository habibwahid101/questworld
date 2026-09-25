import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <AuthFrame
      title="Create an account"
      description="Registration collects the fields below. No email verification flow is included."
    >
      <RegisterForm />
    </AuthFrame>
  );
}
