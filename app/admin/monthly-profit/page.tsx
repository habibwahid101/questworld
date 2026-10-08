import type { Metadata } from "next";
import { AdminProfitsPanel } from "@/components/admin/AdminProfitsPanel";

export const metadata: Metadata = { title: "Monthly profit" };

export default function AdminMonthlyProfitPage() {
  return <AdminProfitsPanel />;
}
