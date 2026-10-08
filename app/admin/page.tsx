import type { Metadata } from "next";
import { AdminOverviewPanel } from "@/components/admin/AdminOverviewPanel";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function AdminDashboardPage() {
  return <AdminOverviewPanel />;
}
