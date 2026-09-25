import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { referralRates } from "@/constants/site";
import { pageMetadata } from "@/utils/metadata";

export const metadata: Metadata = pageMetadata(
  "Referral Program",
  "Questra World uses two referral levels: 3% Direct Sponsor and 1% Second Generation.",
  "/referrals",
);

export default function ReferralsPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Referral Program</p>
          <h1>A → B → C</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            If C has an active investment, B receives {referralRates.directSponsorPercent}%
            Direct Sponsor and A receives {referralRates.secondGenerationPercent}% Second
            Generation. There is no Generation 3 or later commission.
          </p>
        </div>
        <Card>
          <div className="cluster" style={{ justifyContent: "center", minHeight: 96 }}>
            <strong>A</strong>
            <span aria-hidden="true">→</span>
            <strong>B</strong>
            <span aria-hidden="true">→</span>
            <strong>C</strong>
          </div>
        </Card>
        <div className="grid-2">
          <Card>
            <h2>{referralRates.directSponsorPercent}% Direct Sponsor</h2>
            <p style={{ marginTop: 10 }}>
              Paid to the person immediately above the active investment. In A → B → C,
              that is B when C is active.
            </p>
          </Card>
          <Card>
            <h2>{referralRates.secondGenerationPercent}% Second Generation</h2>
            <p style={{ marginTop: 10 }}>
              Paid one level above the direct sponsor. In A → B → C, that is A when C is
              active.
            </p>
          </Card>
        </div>
        <Card>
          <h2>Eligibility</h2>
          <p style={{ marginTop: 10 }}>
            Referral commissions are generated monthly while the source investment
            remains active. A sponsor does not need an active investment of their own
            to remain eligible for referral commission.
          </p>
        </Card>
        <Button href="/register">Start Referring</Button>
      </div>
    </section>
  );
}
