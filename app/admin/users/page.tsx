import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <PagePlaceholder
      title="Users"
      description="Member directory and account status controls are reserved for a later step."
    />
  );
}
