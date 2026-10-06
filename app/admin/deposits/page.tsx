import type { Metadata } from "next";
import { AdminDepositsPanel } from "@/components/admin/AdminDepositsPanel";

export const metadata: Metadata = { title: "Deposits" };

export default function AdminDepositsPage() {
  return <AdminDepositsPanel />;
}
