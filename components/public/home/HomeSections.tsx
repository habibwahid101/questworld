import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { brand, investmentPlans, referralRates, yearlyReturnCopy } from "@/constants/site";
import styles from "./HomeSections.module.css";

const advantages = [
  {
    title: "Manual deposit verification",
    body: "A deposit stays pending until it is checked. Sending USDT does not activate a plan by itself.",
    icon: "/landing/advantage-verification.png",
    iconAlt: "Verification",
  },
  {
    title: "BEP20 and TRC20 wallets",
    body: "Members deposit with the BEP20 and TRC20 wallet addresses shown in the account.",
    icon: "/landing/advantage-wallet.png",
    iconAlt: "Wallet",
  },
  {
    title: "Admin review",
    body: "An admin reviews the deposit before an investment can become active.",
    icon: "/landing/advantage-review.png",
    iconAlt: "Review",
  },
  {
    title: "Monthly return",
    body: "After activation, the return is posted once a month. Twelve posts are a total return of 2× the investment.",
    icon: "/landing/advantage-return.png",
    iconAlt: "Monthly return",
  },
  {
    title: `${referralRates.directSponsorPercent}% + ${referralRates.secondGenerationPercent}% commission`,
    body: `Generation 1 is ${referralRates.directSponsorPercent}% and Generation 2 is ${referralRates.secondGenerationPercent}%. There is no higher level.`,
    icon: "",
    iconAlt: "",
  },
] as const;

const steps = [
  { number: "01", title: "Register", body: "Create a Questra World account." },
  { number: "02", title: "Choose plan", body: "Select one of the four listed plans." },
  { number: "03", title: "Deposit to wallet", body: "Send USDT to the BEP20 or TRC20 wallet and submit the reference." },
  { number: "04", title: "Admin verifies", body: "The deposit stays pending until an admin verifies it." },
  { number: "05", title: "Active", body: "An admin activates a verified deposit. The return schedule starts then." },
  { number: "06", title: "Monthly return", body: "A return is posted once a month for 12 months. A post is not a payout." },
] as const;

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <Image
          className={styles.logo}
          src="/brand/logo.png"
          alt={brand.name}
          width={1000}
          height={300}
          priority
          unoptimized
        />
        <div className={styles.heroCopy}>
          <h1>{brand.name}</h1>
          <p className="lead">On an active investment, the scheduled return is a total of 2× over 12 months.</p>
          <div className={`cluster ${styles.actions}`}>
            <Button href="/register">Create account</Button>
            <Button href="/login" variant="ghost">
              Login
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AdvantageSection() {
  return (
    <section className="section">
      <div className="container stack">
        <div className={styles.sectionHead}>
          <p className="eyebrow">Our Advantage</p>
          <h2>What the account actually does</h2>
        </div>
        <div className={styles.advantageGrid}>
          {advantages.map((item) => (
            <Card key={item.title} className={styles.panel}>
              {item.icon ? (
                <Image className={styles.icon} src={item.icon} alt={item.iconAlt} width={512} height={512} unoptimized />
              ) : null}
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowSection() {
  return (
    <section className="section section-muted">
      <div className="container stack">
        <div className={styles.sectionHead}>
          <p className="eyebrow">How it works</p>
          <h2>From registration to a monthly return</h2>
        </div>
        <Image
          className={styles.visual}
          src="/landing/how-it-works.png"
          alt="Register, then plan, then deposit, then active"
          width={1600}
          height={900}
          unoptimized
        />
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step.number}>
              <Card className={styles.panel}>
                <p className={styles.stepNum}>{step.number}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PlansSection() {
  return (
    <section className="section">
      <div className="container stack">
        <div className={styles.sectionHead}>
          <p className="eyebrow">Investment plans</p>
          <h2>Four listed plans</h2>
          <p className="lead">Total return of 2× over 12 months. {yearlyReturnCopy}</p>
        </div>
        <Image
          className={styles.visual}
          src="/landing/plans.png"
          alt="Starter 100 USDT, Growth 1,000 USDT, Professional 10,000 USDT, and Premium 100,000 USDT"
          width={1600}
          height={900}
          unoptimized
        />
        <div className={styles.planGrid}>
          {investmentPlans.map((plan) => (
            <Card key={plan.id} className={styles.panel}>
              <h3>{plan.name}</h3>
              <p className={styles.amount}>{plan.amountUsd.toLocaleString("en-US")} USDT</p>
              <p>Total return of 2× over 12 months.</p>
            </Card>
          ))}
        </div>
        <div className={styles.actions}>
          <Button href="/plans">View plans</Button>
        </div>
      </div>
    </section>
  );
}

export function ReferralSection() {
  return (
    <section className="section section-muted">
      <div className="container stack">
        <div className={styles.sectionHead}>
          <p className="eyebrow">Referral</p>
          <h2>Two generations only</h2>
        </div>
        <Image
          className={styles.visual}
          src="/landing/referral.png"
          alt="Generation 1 is 3 percent and Generation 2 is 1 percent"
          width={1600}
          height={900}
          unoptimized
        />
        <div className={styles.referralGrid}>
          <Card className={styles.panel}>
            <h3>Generation 1</h3>
            <p className={styles.amount}>{referralRates.directSponsorPercent}%</p>
          </Card>
          <Card className={styles.panel}>
            <h3>Generation 2</h3>
            <p className={styles.amount}>{referralRates.secondGenerationPercent}%</p>
          </Card>
        </div>
        <p className={styles.note}>
          There is no higher level. Commissions are recorded only while the source investment is active, and a record is not a payout.
        </p>
        <div className={styles.actions}>
          <Button href="/referrals" variant="ghost">
            Referral program
          </Button>
        </div>
      </div>
    </section>
  );
}

export function RiskSection() {
  return (
    <section className="section">
      <div className={`container ${styles.riskWrap}`}>
        <Card className={styles.risk}>
          <p className="eyebrow">Risk note</p>
          <h2>Returns are not guaranteed</h2>
          <p>Returns are not guaranteed and depend on activation. A monthly return is recorded only after an admin activates the investment.</p>
        </Card>
      </div>
    </section>
  );
}
