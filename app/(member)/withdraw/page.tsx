import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Withdraw" };

export default function WithdrawPage() {
  return (
    <PagePlaceholder
      title="Withdraw"
      description="Withdrawal requests are not processed in this foundation."
    />
  );
}
