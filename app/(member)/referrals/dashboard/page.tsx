import type { Metadata } from "next";
import { CommissionsPanel } from "@/components/member/CommissionsPanel";
import { ReferralList } from "@/components/member/ReferralList";

export const metadata: Metadata = { title: "Referral commissions" };

export default function ReferralDashboardPage() {
  return (
    <div className="stack">
      <ReferralList />
      <CommissionsPanel />
    </div>
  );
}
