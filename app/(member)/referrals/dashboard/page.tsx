import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Referral dashboard" };

export default function ReferralDashboardPage() {
  return (
    <PagePlaceholder
      title="Referral dashboard"
      description="Direct Sponsor 3% and Second Generation 1% records will be shown here after commission processing is built."
    />
  );
}
