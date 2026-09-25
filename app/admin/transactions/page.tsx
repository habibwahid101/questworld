import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Admin transactions" };

export default function AdminTransactionsPage() {
  return (
    <PagePlaceholder
      title="Transactions"
      description="Platform-wide ledger browsing is not implemented in Step 01."
    />
  );
}
