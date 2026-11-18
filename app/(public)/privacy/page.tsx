import type { Metadata } from "next";
import { PRIVACY_POLICY_DOCUMENT } from "@/lib/legal/documents";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Privacy Policy",
  "Questra World Privacy Policy, Version 1.0.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="container-md">
        <article style={{ whiteSpace: "pre-wrap" }}>{PRIVACY_POLICY_DOCUMENT}</article>
      </div>
    </section>
  );
}
