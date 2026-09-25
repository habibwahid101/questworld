import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Privacy Policy",
  "Draft placeholder for the Questra World privacy policy. Not a final legal document.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="container-md stack">
        <div>
          <p className="eyebrow">Draft placeholder</p>
          <h1>Privacy Policy</h1>
        </div>
        <Card>
          <div className="stack">
            <p>
              This page is a draft legal-content placeholder. It does not describe a
              live data-processing program and should not be read as a finished privacy
              notice.
            </p>
            <p>
              When authentication and account records are connected, this page will be
              replaced with the approved privacy policy.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
