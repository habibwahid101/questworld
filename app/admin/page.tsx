import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function AdminDashboardPage() {
  return (
    <PagePlaceholder
      title="Admin dashboard"
      description="Operational summaries for users, plans, deposits, profits, commissions, and withdrawals will be added later."
    />
  );
}
