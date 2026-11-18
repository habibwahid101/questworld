import type { Metadata } from "next";
import { TERMS_OF_SERVICE_DOCUMENT } from "@/lib/legal/documents";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Terms of Service",
  "Questra World Terms of Service, Version 1.0.",
  "/terms",
);

export default function TermsPage() {
  return (
    <section className="section">
      <div className="container-md">
        <article style={{ whiteSpace: "pre-wrap" }}>{TERMS_OF_SERVICE_DOCUMENT}</article>
      </div>
    </section>
  );
}
