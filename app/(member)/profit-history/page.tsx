import type { Metadata } from "next";
import { ProfitHistoryPanel } from "@/components/member/ProfitHistoryPanel";

export const metadata: Metadata = { title: "Profit history" };

export default function ProfitHistoryPage() {
  return <ProfitHistoryPanel />;
}
