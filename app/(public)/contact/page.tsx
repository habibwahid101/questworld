import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Contact / Support",
  "Placeholder contact page for Questra World support.",
  "/contact",
);

export default function ContactPage() {
  return (
    <section className="section">
      <div className="container-md stack">
        <div>
          <p className="eyebrow">Support placeholder</p>
          <h1>Contact / Support</h1>
        </div>
        <Card>
          <div className="stack">
            <p>
              Support contact details have not been published yet. No office address,
              phone number, or registration number is listed here.
            </p>
            <p>
              Use the account pages to review the current product structure. A support
              channel will be added when operations are approved.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
