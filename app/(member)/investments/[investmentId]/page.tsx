import type { Metadata } from "next";
import { InvestmentPaymentPanel } from "@/components/member/InvestmentPaymentPanel";

export const metadata: Metadata = { title: "Payment" };

export default async function InvestmentPaymentPage({
  params,
}: {
  params: Promise<{ investmentId: string }>;
}) {
  const { investmentId } = await params;
  return <InvestmentPaymentPanel investmentId={investmentId} />;
}
