import type { Metadata } from "next";
import { InvestmentsPanel } from "@/components/member/InvestmentsPanel";

export const metadata: Metadata = { title: "Investments" };

export default function InvestmentsPage() {
  return <InvestmentsPanel />;
}
