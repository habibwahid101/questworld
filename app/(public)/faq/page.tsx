import type { Metadata } from "next";
import { Accordion } from "@/components/ui/Accordion";
import { Card } from "@/components/ui/Card";
import { faqItems } from "@/constants/site";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "FAQ",
  "Answers about Questra World plans, monthly earnings, referrals, payments, and withdrawals.",
  "/faq",
);

export default function FaqPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">FAQ</p>
          <h1>Common questions</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            These answers follow the locked public product rules. They do not add
            extra financial promises.
          </p>
        </div>
        <Accordion items={faqItems} />
        <Card quiet>
          <p>
            Authentication, deposits, withdrawals, and commission posting are not
            connected in this version. The forms and pages are ready for later backend
            work.
          </p>
        </Card>
      </div>
    </section>
  );
}
