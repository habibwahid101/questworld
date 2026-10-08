import type { Metadata } from "next";
import { AdminInvestmentsPanel } from "@/components/admin/AdminInvestmentsPanel";

export const metadata: Metadata = { title: "Admin investments" };

export default function AdminInvestmentsPage() {
  return <AdminInvestmentsPanel />;
}
