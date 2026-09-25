import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Investments" };

export default function InvestmentsPage() {
  return (
    <PagePlaceholder
      title="Investments"
      description="Allocated plans will be listed here. No investment engine is connected."
    />
  );
}
