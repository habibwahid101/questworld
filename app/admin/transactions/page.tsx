import type { Metadata } from "next";
import { AdminAccountHistory } from "@/components/member/AccountHistory";

export const metadata: Metadata = { title: "Admin transactions" };

export default function AdminTransactionsPage() {
  return <AdminAccountHistory />;
}
