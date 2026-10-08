import type { Metadata } from "next";
import { AdminCommissionsPanel } from "@/components/admin/AdminCommissionsPanel";

export const metadata: Metadata = { title: "Referral commissions" };

export default function AdminReferralCommissionsPage() {
  return <AdminCommissionsPanel />;
}
