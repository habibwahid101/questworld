import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Referral commissions" };

export default function AdminReferralCommissionsPage() {
  return (
    <PagePlaceholder
      title="Referral commissions"
      description="Admin commission review for 3% Direct Sponsor and 1% Second Generation is not live."
    />
  );
}
