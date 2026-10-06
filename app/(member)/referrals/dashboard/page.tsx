import type { Metadata } from "next";
import { CommissionsPanel } from "@/components/member/CommissionsPanel";

export const metadata: Metadata = { title: "Referral commissions" };

export default function ReferralDashboardPage() {
  return <CommissionsPanel />;
}
