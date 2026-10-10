"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Button href="/login" variant="ghost">
            Login
          </Button>
          <Button href="/register">Create Account</Button>
        </div>
        <button
          className={styles.menuButton}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <svg className={styles.menuIcon} viewBox="0 0 18 14" aria-hidden="true">
            <path d="M1 1h16M1 7h16M1 13h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open ? (
        <nav id="mobile-nav" className={`container ${styles.mobilePanel}`} aria-label="Mobile">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.mobileLink}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Button href="/login" variant="ghost">
            Login
          </Button>
          <Button href="/register">Create Account</Button>
        </nav>
      ) : null}
    </header>
  );
}
