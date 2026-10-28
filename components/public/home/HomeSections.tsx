import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import styles from "./HomeSections.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">Questra World</p>
          <h1>Marketing partner of Atlantic Global Asset Management (AGAM)</h1>
          <p className="lead" style={{ marginTop: 16 }}>
            Create your account to access the member dashboard.
          </p>
          <div className="cluster" style={{ marginTop: 24 }}>
            <Button href="/register">Create Account</Button>
            <Button href="/login" variant="ghost">
              Login
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutSection() {
  return (
    <section className="section section-muted">
      <div className="container stack">
        <div>
          <p className="eyebrow">About</p>
          <h2>Atlantic Global Asset Management</h2>
        </div>
        <Card>
          <p>
            Atlantic Global Asset Management (AGAM) is part of Questra Holdings Inc. The group has operated since 2009.
          </p>
          <p style={{ marginTop: 12 }}>
            Questra World supports the promotion of AGAM opportunities.
          </p>
        </Card>
      </div>
    </section>
  );
}

export function BusinessSection() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Business</p>
          <h2>What AGAM focuses on</h2>
        </div>
        <div className="grid-2">
          <Card>
            <h3>Asset activity</h3>
            <p style={{ marginTop: 10 }}>
              Buying and selling debt obligations and shares related to company IPOs.
            </p>
          </Card>
          <Card>
            <h3>Securities & refinancing</h3>
            <p style={{ marginTop: 10 }}>
              Placement of foreign securities, company refinancing, and financial factoring.
            </p>
          </Card>
          <Card>
            <h3>Company rehabilitation</h3>
            <p style={{ marginTop: 10 }}>
              Rehabilitation of companies and related asset activity.
            </p>
          </Card>
          <Card>
            <h3>Questra World role</h3>
            <p style={{ marginTop: 10 }}>
              Marketing and promotion partner for these activities.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function HowToStartSection() {
  return (
    <section className="section section-muted">
      <div className="container stack">
        <div>
          <p className="eyebrow">How to start</p>
          <h2>Four steps</h2>
        </div>
        <div className="grid-2">
          <Card>
            <p className={styles.stepNum}>01</p>
            <h3 style={{ marginTop: 10 }}>Create an account</h3>
          </Card>
          <Card>
            <p className={styles.stepNum}>02</p>
            <h3 style={{ marginTop: 10 }}>Sign in to the dashboard</h3>
          </Card>
          <Card>
            <p className={styles.stepNum}>03</p>
            <h3 style={{ marginTop: 10 }}>Choose a plan and complete the deposit process</h3>
          </Card>
          <Card>
            <p className={styles.stepNum}>04</p>
            <h3 style={{ marginTop: 10 }}>Track your records from the member area</h3>
          </Card>
        </div>
        <Button href="/register">Create Account</Button>
      </div>
    </section>
  );
}

export function NotesSection() {
  return (
    <section className="section">
      <div className="container stack">
        <div>
          <p className="eyebrow">Important notes</p>
          <h2>Before you continue</h2>
        </div>
        <Card>
          <ul className={styles.notes}>
            <li>All investment plans, amounts, and records are available only inside the member dashboard.</li>
            <li>Deposit and withdrawal requests are reviewed manually.</li>
            <li>Past performance figures or high-return claims from older materials are not used on this page.</li>
            <li>Members should review the current rules and status inside their account before proceeding.</li>
          </ul>
        </Card>
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
            <h2>Access the member dashboard</h2>
            <p>
              Create an account or sign in to view plans and records.
            </p>
            <div className="cluster">
              <Button href="/register">Create Account</Button>
              <Button href="/login" variant="ghost">
                Login
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
