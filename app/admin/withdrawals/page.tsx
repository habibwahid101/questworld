import type { Metadata } from "next";
import { AdminWithdrawalsPanel } from "@/components/admin/AdminWithdrawalsPanel";

export const metadata: Metadata = { title: "Withdrawals" };

export default function AdminWithdrawalsPage() {
  return <AdminWithdrawalsPanel />;
}
