import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Monthly profit" };

export default function AdminMonthlyProfitPage() {
  return (
    <PagePlaceholder
      title="Monthly profit"
      description="Monthly profit posting tools will be designed after the calculation rules are approved."
    />
  );
}
