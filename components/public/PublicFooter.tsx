import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { brand, footerAccountNav, footerExploreNav } from "@/constants/site";
import styles from "./PublicFooter.module.css";

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div className="stack">
            <BrandMark />
            <p>
              {brand.name} is a structured platform for listed investment plans, monthly
              earnings records, a two-generation referral program, and withdrawal requests.
            </p>
          </div>
          <div className={styles.links}>
            <strong>Explore</strong>
            {footerExploreNav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className={styles.links}>
            <strong>Account & policies</strong>
            {footerAccountNav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <p className={styles.copy}>
          © {new Date().getFullYear()} {brand.name}. Public figures on this site are
          informational display content, not a guarantee of returns.
        </p>
      </div>
    </footer>
  );
}
