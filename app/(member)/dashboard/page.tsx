import type { Metadata } from "next";
import { DashboardPanel } from "@/components/member/DashboardPanel";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardPanel />;
}
