"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { publicNav } from "@/constants/site";
import { classNames } from "@/utils/format";
import styles from "./PublicHeader.module.css";

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <BrandMark />
        <nav className={styles.desktopNav} aria-label="Primary">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(styles.navLink, pathname === item.href && styles.navLinkActive)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Button href="/login" variant="ghost">
            Log in
          </Button>
          <Button href="/register">Create account</Button>
        </div>
        <button
          className={styles.menuButton}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          Menu
        </button>
      </div>
      {open ? (
        <div id="mobile-nav" className={`container ${styles.mobilePanel}`}>
          {publicNav.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Button href="/login" variant="ghost">
            Log in
          </Button>
          <Button href="/register">Create account</Button>
        </div>
      ) : null}
    </header>
  );
}
