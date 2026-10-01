import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PagePlaceholder
      title="Member dashboard"
      description="Overview cards for plans, profits, referrals, and wallet activity will appear here after backend work is approved."
      note="Authentication is connected. Additional dashboard features, ledger processing, and other AWS-backed services will be added in later approved steps."
    />
  );
}
