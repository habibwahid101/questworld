import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Profit history" };

export default function ProfitHistoryPage() {
  return (
    <PagePlaceholder
      title="Profit history"
      description="Monthly profit records will appear in a mobile-safe table when the profit engine is approved."
    />
  );
}
