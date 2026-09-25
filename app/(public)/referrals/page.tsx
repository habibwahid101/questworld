import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { referralRates } from "@/constants/site";

export const metadata: Metadata = {
  title: "Referrals",
  description: "Listed Questra World referral levels.",
};

export default function ReferralsPage() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Referrals</p>
          <h1>Listed referral structure</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            Commission calculation, eligibility, and payout timing are not implemented
            in Step 01.
          </p>
        </div>
        <div className="grid-2">
          <Card>
            <h2>{referralRates.directSponsorPercent}% Direct Sponsor</h2>
            <p style={{ marginTop: 10 }}>
              Display rate for a first-level referral relationship.
            </p>
          </Card>
          <Card>
            <h2>{referralRates.secondGenerationPercent}% Second Generation</h2>
            <p style={{ marginTop: 10 }}>
              Display rate for a second-level referral relationship.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
