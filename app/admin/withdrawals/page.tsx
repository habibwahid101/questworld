import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Withdrawals" };

export default function AdminWithdrawalsPage() {
  return (
    <PagePlaceholder
      title="Withdrawals"
      description="Withdrawal approval and payout actions are reserved for a later approved step."
    />
  );
}
