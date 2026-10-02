import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Admin investments" };

export default function AdminInvestmentsPage() {
  return (
    <PagePlaceholder
      title="Investments"
      description="Admin review is not part of this step. Activation and deposit verification are later work."
    />
  );
}
