import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { faqPreview } from "@/constants/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Foundation questions for Questra World.",
};

const extra = [
  {
    question: "Are returns guaranteed?",
    answer:
      "This foundation does not publish return guarantees. Any later figures must be approved before they appear as product terms.",
  },
  {
    question: "Can I deposit or withdraw today?",
    answer:
      "No. Wallet, deposit, and withdrawal processing are reserved for later steps after the AWS backend is approved.",
  },
];

export default function FaqPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">FAQ</p>
          <h1>Common questions</h1>
        </div>
        <div className="stack">
          {[...faqPreview, ...extra].map((item) => (
            <Card key={item.question}>
              <h2>{item.question}</h2>
              <p style={{ marginTop: 10 }}>{item.answer}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
