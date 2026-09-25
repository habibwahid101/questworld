import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Deposits" };

export default function AdminDepositsPage() {
  return (
    <PagePlaceholder
      title="Deposits"
      description="Deposit review and confirmation actions are intentionally unimplemented."
    />
  );
}
