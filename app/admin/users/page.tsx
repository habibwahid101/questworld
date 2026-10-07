import type { Metadata } from "next";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return <AdminUsersPanel />;
}
