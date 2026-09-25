import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { brand, publicNav } from "@/constants/site";
import styles from "./PublicFooter.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div className="stack">
            <BrandMark />
            <p>
              {brand.name} is being built as a restrained, professional investment-plan
              platform. Product engines and financial processing are not live in this
              foundation release.
            </p>
          </div>
          <div className={styles.links}>
            <strong>Explore</strong>
            {publicNav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className={styles.links}>
            <strong>Account</strong>
            <Link href="/login">Log in</Link>
            <Link href="/register">Register</Link>
            <Link href="/forgot-password">Forgot password</Link>
          </div>
        </div>
        <p className={styles.copy}>
          © {new Date().getFullYear()} {brand.name}. Content on this site is structural
          and informational. It is not an offer of guaranteed returns.
        </p>
      </div>
    </footer>
  );
}
