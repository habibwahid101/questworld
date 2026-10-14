import type { Metadata } from "next";
import { WalletPanel } from "@/components/member/WalletPanel";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <WalletPanel />;
}
