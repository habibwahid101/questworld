import type { Metadata } from "next";
import { WithdrawPanel } from "@/components/member/WithdrawPanel";

export const metadata: Metadata = { title: "Withdraw" };

export default function WithdrawPage() {
  return <WithdrawPanel />;
}
