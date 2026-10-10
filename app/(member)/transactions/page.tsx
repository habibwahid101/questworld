import type { Metadata } from "next";
import { MemberAccountHistory } from "@/components/member/AccountHistory";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return <MemberAccountHistory />;
}
