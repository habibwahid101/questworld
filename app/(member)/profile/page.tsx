import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <PagePlaceholder
      title="Profile"
      description="Name, email, and security settings will be bound to Cognito in a later step."
    />
  );
}
