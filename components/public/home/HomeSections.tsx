import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { brand, faqPreview, investmentPlans, referralRates } from "@/constants/site";
import { formatUsd } from "@/utils/format";
import styles from "./HomeSections.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <div>
          <p className="eyebrow">{brand.name}</p>
          <h1>A clear structure for allocated investment plans.</h1>
          <p className="lead" style={{ marginTop: 16 }}>
            Questra World is being prepared as a professional member platform for plan
            allocation, monthly profit records, referrals, and withdrawals. This release
            establishes the product foundation only.
          </p>
          <div className={styles.actions}>
            <Button href="/register">Create account</Button>
            <Button href="/plans" variant="ghost">
              View plans
            </Button>
          </div>
        </div>
        <Card className={styles.panel} quiet>
          <div className="stack">
            <Badge>Foundation preview</Badge>
            <h2>What this platform will contain</h2>
            <p>
              Member records, plan selections, profit history, referral tracking, and
              wallet activity. None of those engines are connected yet.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function BenefitsSection() {
  const items = [
    {
      title: "Plan clarity",
      body: "Listed plan sizes are presented without promotional clutter so members can review allocations calmly.",
    },
    {
      title: "Recorded activity",
      body: "The member area is structured around investments, profits, referrals, wallet, and withdrawals.",
    },
    {
      title: "Operational control",
      body: "An admin shell is prepared for users, deposits, monthly profit, commissions, and settings.",
    },
  ];

  return (
    <section className="section section-muted">
      <div className="container stack">
        <div>
          <p className="eyebrow">Key benefits</p>
          <h2>Built to feel measured and trustworthy.</h2>
        </div>
        <div className="grid-3">
          {items.map((item) => (
            <Card key={item.title}>
              <h3>{item.title}</h3>
              <p style={{ marginTop: 10 }}>{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    { title: "Create an account", body: "Register with your name, email, and optional referral code." },
    { title: "Review a plan size", body: "Choose from the listed allocations when the investment engine is enabled." },
    { title: "Track records", body: "Use the member area to review profits, referrals, wallet, and withdrawals." },
  ];

  return (
    <section className="section" id="how-it-works">
      <div className="container stack">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>A simple path from account to records.</h2>
        </div>
        <div className="grid-3">
          {steps.map((step, index) => (
            <Card key={step.title}>
              <Badge tone="neutral">Step {index + 1}</Badge>
              <h3 style={{ marginTop: 14 }}>{step.title}</h3>
              <p style={{ marginTop: 10 }}>{step.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlansSection() {
  return (
    <section className="section section-muted" id="plans">
      <div className="container stack">
        <div>
          <p className="eyebrow">Investment plans</p>
          <h2>Listed allocation sizes.</h2>
          <p className="lead">
            These are display values only. Monthly profit terms are not published in this
            foundation and should not be assumed.
          </p>
        </div>
        <div className="grid-4">
          {investmentPlans.map((plan) => (
            <Card key={plan.id}>
              <p className="eyebrow">Plan</p>
              <h3>{formatUsd(plan.amountUsd)}</h3>
              <p style={{ marginTop: 10 }}>{plan.summary}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EarningsExampleSection() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Monthly earnings example</p>
          <h2>Illustrative layout, not a performance claim.</h2>
          <p className="lead">
            The table shows how a monthly record may appear later. Figures below are
            placeholders and are not live calculations.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan size</th>
                <th>Example month</th>
                <th>Record status</th>
                <th>Displayed figure</th>
              </tr>
            </thead>
            <tbody>
              {investmentPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>{formatUsd(plan.amountUsd)}</td>
                  <td>Not published</td>
                  <td>Placeholder</td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function ReferralSection() {
  return (
    <section className="section section-muted">
      <div className="container">
        <div className="grid-2">
          <div>
            <p className="eyebrow">Referral program</p>
            <h2>Two listed referral levels.</h2>
            <p className="lead" style={{ marginTop: 12 }}>
              Commission calculation and payout processing are not implemented yet. The
              rates below are displayed for product structure only.
            </p>
          </div>
          <div className="grid-2">
            <Card>
              <h3>{referralRates.directSponsorPercent}% Direct Sponsor</h3>
              <p style={{ marginTop: 10 }}>Listed first-level referral rate.</p>
            </Card>
            <Card>
              <h3>{referralRates.secondGenerationPercent}% Second Generation</h3>
              <p style={{ marginTop: 10 }}>Listed second-level referral rate.</p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhySection() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Why Questra World</p>
          <h2>Premium restraint over promotional noise.</h2>
        </div>
        <div className="grid-3">
          <Card>
            <h3>Clear information architecture</h3>
            <p style={{ marginTop: 10 }}>
              Public pages, member records, and admin operations are separated from the start.
            </p>
          </Card>
          <Card>
            <h3>AWS-ready foundation</h3>
            <p style={{ marginTop: 10 }}>
              The application is prepared for Amplify Hosting and later Cognito, API Gateway,
              Lambda, DynamoDB, and S3 work.
            </p>
          </Card>
          <Card>
            <h3>Cost-aware delivery</h3>
            <p style={{ marginTop: 10 }}>
              No always-on servers or managed databases are introduced in this step.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function FaqPreviewSection() {
  return (
    <section className="section section-muted">
      <div className="container stack">
        <div>
          <p className="eyebrow">FAQ preview</p>
          <h2>Short answers for this foundation.</h2>
        </div>
        <div className="grid-3">
          {faqPreview.map((item) => (
            <Card key={item.question}>
              <h3>{item.question}</h3>
              <p style={{ marginTop: 10 }}>{item.answer}</p>
            </Card>
          ))}
        </div>
        <Button href="/faq" variant="ghost">
          View all questions
        </Button>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="section">
      <div className="container">
        <Card>
          <div className="stack">
            <p className="eyebrow">Next step</p>
            <h2>Create an account when you are ready to explore the member shell.</h2>
            <p>
              Registration currently collects details only. No verification flow or backend
              account creation is connected.
            </p>
            <div className="cluster">
              <Button href="/register">Register</Button>
              <Button href="/how-it-works" variant="ghost">
                Read how it works
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
