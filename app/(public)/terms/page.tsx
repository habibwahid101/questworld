import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Terms & Conditions",
  "Draft placeholder for Questra World terms. Not a final legal document.",
  "/terms",
);

export default function TermsPage() {
  return (
    <section className="section">
      <div className="container-md stack">
        <div>
          <p className="eyebrow">Draft placeholder</p>
          <h1>Terms & Conditions</h1>
        </div>
        <Card>
          <div className="stack">
            <p>
              This page is a draft legal-content placeholder. It is not a completed
              terms document and does not claim regulatory approval, licensing, or
              guaranteed returns.
            </p>
            <p>
              Account registration, investments, referrals, and withdrawals will be
              governed by the approved terms once they are published here.
            </p>
            <p>
              Until that document is added, treat all public product pages as
              informational structure only.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
