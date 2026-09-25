import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  displayMonthlyRatePercent,
  faqItems,
  howItWorksSteps,
  investmentPlans,
  referralRates,
  whyItems,
} from "@/constants/site";
import type { InvestmentPlan } from "@/types";
import { estimatedMonthlyProfit, formatUsd, formatUsdPrecise } from "@/utils/format";
import styles from "./HomeSections.module.css";

function PlanCard({ plan }: { plan: InvestmentPlan }) {
  const monthly = estimatedMonthlyProfit(plan.amountUsd, displayMonthlyRatePercent);

  return (
    <Card className={`${styles.planCard} ${plan.featured ? styles.planCardFeatured : ""}`}>
      <div className="cluster">
        <p className="eyebrow">{plan.name}</p>
        {plan.featured ? <Badge tone="info">Popular</Badge> : null}
      </div>
      <p className={styles.planAmount}>{formatUsd(plan.amountUsd)}</p>
      <div className={styles.planMeta}>
        <p>
          Current Monthly Rate: {displayMonthlyRatePercent}%
        </p>
        <p>
          Estimated Monthly Earnings: {formatUsdPrecise(monthly)}
        </p>
        <p>
          {formatUsd(plan.amountUsd)} × {displayMonthlyRatePercent}% = {formatUsdPrecise(monthly)} monthly
        </p>
        <p>Referral eligible</p>
        <p>USDT payment</p>
      </div>
      <Button href="/register">{plan.ctaLabel}</Button>
    </Card>
  );
}

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">Questra World</p>
          <h1>Build Your Investment Journey with Questra World</h1>
          <p className="lead" style={{ marginTop: 16 }}>
            Choose an investment plan, manage your portfolio, track applicable monthly
            earnings, and benefit from a simple two-generation referral program.
          </p>
          <p className={styles.heroNote}>Starting from $100</p>
          <div className="cluster" style={{ marginTop: 24 }}>
            <Button href="/register">Start Investing</Button>
            <Button href="/plans" variant="ghost">
              View Investment Plans
            </Button>
          </div>
        </div>
        <div className={styles.visual} aria-hidden="true">
          <div className={styles.visualTop}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Active plan</div>
              <div className={styles.metricValue}>Growth</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Allocation</div>
              <div className={styles.metricValue}>$1,000</div>
            </div>
          </div>
          <div className={styles.visualRow}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Current monthly rate</div>
              <div className={styles.metricValue}>{displayMonthlyRatePercent}%</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Estimated monthly</div>
              <div className={styles.metricValue}>$80</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HighlightsSection() {
  const items = [
    { value: "Starting from $100", label: "Minimum listed plan" },
    { value: "Monthly Earnings", label: "Tracked by investment period" },
    { value: `${referralRates.directSponsorPercent}% Direct Referral`, label: "First generation" },
    { value: `${referralRates.secondGenerationPercent}% Second Generation`, label: "Second generation only" },
  ];

  return (
    <section className="section section-muted">
      <div className="container">
        <div className={styles.highlights}>
          {items.map((item) => (
            <Card key={item.value} className={styles.highlight} quiet>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="section" id="how-it-works">
      <div className="container stack">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Four clear steps from account to records.</h2>
        </div>
        <div className="grid-2">
          {howItWorksSteps.map((step) => (
            <Card key={step.number}>
              <p className={styles.stepNum}>{step.number}</p>
              <h3 style={{ marginTop: 10 }}>{step.title}</h3>
              <p style={{ marginTop: 8 }}>{step.body}</p>
            </Card>
          ))}
        </div>
        <Button href="/register">Create Your Account</Button>
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
          <h2>Four listed allocations.</h2>
          <p className="lead">
            Current Monthly Rate shown below is display content for these pages. The
            applicable rate will come from the backend in a later step.
          </p>
        </div>
        <div className={styles.planGrid}>
          {investmentPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function EarningsExampleSection() {
  const amount = 1000;
  const monthly = estimatedMonthlyProfit(amount, displayMonthlyRatePercent);

  return (
    <section className="section">
      <div className="container">
        <div className="grid-2">
          <div>
            <p className="eyebrow">Monthly earnings example</p>
            <h2>A simple period example, not a compounded projection.</h2>
            <p className="lead" style={{ marginTop: 12 }}>
              Earnings are calculated according to the applicable monthly rate for the
              investment period.
            </p>
          </div>
          <Card>
            <div className={styles.example}>
              <div className={styles.exampleRow}>
                <span>Active Investment</span>
                <span>{formatUsd(amount)}</span>
              </div>
              <div className={styles.exampleRow}>
                <span>Current Monthly Rate</span>
                <span>{displayMonthlyRatePercent}%</span>
              </div>
              <div className={styles.exampleRow}>
                <span>Estimated Monthly Profit</span>
                <span>{formatUsdPrecise(monthly)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function ReferralSection() {
  return (
    <section className="section section-muted">
      <div className="container stack">
        <div>
          <p className="eyebrow">Referral program</p>
          <h2>Two generations. No further levels.</h2>
          <p className="lead">
            Referral commissions are generated monthly while the source investment
            remains active. A sponsor does not need an active investment of their own
            to remain eligible for referral commission.
          </p>
        </div>
        <Card>
          <div className={styles.diagram} aria-label="Referral relationship A to B to C">
            <div className={styles.node}>A</div>
            <div className={styles.arrow} aria-hidden="true">
              →
            </div>
            <div className={styles.node}>B</div>
            <div className={styles.arrow} aria-hidden="true">
              →
            </div>
            <div className={styles.node}>C</div>
          </div>
        </Card>
        <div className="grid-2">
          <Card className={styles.commission}>
            <h3>If C has an active investment</h3>
            <p style={{ marginTop: 10 }}>
              B receives {referralRates.directSponsorPercent}% Direct Sponsor.
            </p>
          </Card>
          <Card className={styles.commission}>
            <h3>Second generation</h3>
            <p style={{ marginTop: 10 }}>
              A receives {referralRates.secondGenerationPercent}% Second Generation.
            </p>
          </Card>
        </div>
        <Button href="/register">Start Referring</Button>
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
          <h2>Professional structure, stated plainly.</h2>
        </div>
        <div className="grid-3">
          {whyItems.map((item) => (
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

export function PaymentSection() {
  return (
    <section className="section section-muted">
      <div className="container">
        <div className="grid-2">
          <Card>
            <p className="eyebrow">Deposit</p>
            <h2>Manual USDT payment</h2>
            <div className={styles.process} style={{ marginTop: 16 }}>
              <div className={styles.processItem}>
                <span className={styles.processMark}>1</span>
                <p>Send USDT</p>
              </div>
              <div className={styles.processItem}>
                <span className={styles.processMark}>2</span>
                <p>Submit transaction details</p>
              </div>
              <div className={styles.processItem}>
                <span className={styles.processMark}>3</span>
                <p>Admin verification</p>
              </div>
              <div className={styles.processItem}>
                <span className={styles.processMark}>4</span>
                <p>Investment activation</p>
              </div>
            </div>
          </Card>
          <Card>
            <p className="eyebrow">Withdrawal</p>
            <h2>Request, review, paid</h2>
            <div className={styles.process} style={{ marginTop: 16 }}>
              <div className={styles.processItem}>
                <span className={styles.processMark}>1</span>
                <p>Submit withdrawal request</p>
              </div>
              <div className={styles.processItem}>
                <span className={styles.processMark}>2</span>
                <p>Admin review</p>
              </div>
              <div className={styles.processItem}>
                <span className={styles.processMark}>3</span>
                <p>Processing</p>
              </div>
              <div className={styles.processItem}>
                <span className={styles.processMark}>4</span>
                <p>Paid · 1–3 business days</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function FaqPreviewSection() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2>Answers aligned to the current product rules.</h2>
        </div>
        <Accordion items={faqItems} />
        <Button href="/faq" variant="ghost">
          Open the full FAQ page
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
            <p className="eyebrow">Get started</p>
            <h2>Start Your Questra World Journey</h2>
            <p>
              Create an account to review the member area structure, or explore the
              listed plans first.
            </p>
            <div className="cluster">
              <Button href="/register">Create Account</Button>
              <Button href="/plans" variant="ghost">
                Explore Plans
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
