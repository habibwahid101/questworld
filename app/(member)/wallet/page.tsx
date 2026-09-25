import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return (
    <PagePlaceholder
      title="Wallet"
      description="Available balance and ledger summaries are reserved for a later AWS-backed step."
    />
  );
}
