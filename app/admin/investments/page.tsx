import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Admin investments" };

export default function AdminInvestmentsPage() {
  return (
    <PagePlaceholder
      title="Investments"
      description="Admin review of allocated plans is not connected yet."
    />
  );
}
