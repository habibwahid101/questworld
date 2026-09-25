import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <PagePlaceholder
      title="Transactions"
      description="A mobile-safe transaction list will be connected when ledger logic is approved."
    />
  );
}
