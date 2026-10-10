"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { adminSwitchTarget } from "@/lib/auth/shell";
import { memberPhoneNav } from "@/constants/site";
import { BrandMark } from "@/components/ui/BrandMark";
import type { NavItem } from "@/types";
import { classNames } from "@/utils/format";
import styles from "./AppShell.module.css";

type AppShellProps = {
  title: string;
  homeHref: string;
  items: readonly NavItem[];
  showPhoneBar?: boolean;
  children: React.ReactNode;
};

export function AppShell({ title, homeHref, items, showPhoneBar = false, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { logout, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const shellSwitch = user?.isAdmin ? adminSwitchTarget(pathname) : null;

  async function onLogout() {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      await logout();
      window.location.assign("/login");
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <BrandMark href={homeHref} inverse />
        </div>
        <nav className={styles.nav} aria-label={title}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(styles.navLink, pathname === item.href && styles.navLinkActive)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        <div className={styles.topbar}>
          <strong className={styles.topTitle}>{title}</strong>
          <div className={styles.topActions}>
            {shellSwitch ? (
              <Link className={styles.logoutButton} href={shellSwitch.href}>
                {shellSwitch.label}
              </Link>
            ) : null}
            <button className={classNames(styles.logoutButton, styles.topLogout)} type="button" onClick={() => void onLogout()} disabled={signingOut}>
              {signingOut ? "Please wait…" : "Log out"}
            </button>
            <button
              className={styles.menuButton}
              type="button"
              aria-expanded={open}
              aria-label="Menu"
              onClick={() => setOpen((value) => !value)}
            >
              <svg className={styles.menuIcon} viewBox="0 0 18 14" aria-hidden="true">
                <path d="M1 1h16M1 7h16M1 13h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {open ? (
          <nav className={styles.mobileNav} aria-label={`${title} mobile`}>
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <button className={styles.mobileLogout} type="button" onClick={() => void onLogout()} disabled={signingOut}>
              {signingOut ? "Please wait…" : "Log out"}
            </button>
          </nav>
        ) : null}
        <div className={classNames(styles.content, showPhoneBar && styles.withPhoneBar)}>{children}</div>
      </div>
      {showPhoneBar ? (
        <nav className={styles.phoneBar} aria-label="Member">
          {memberPhoneNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(styles.phoneLink, (pathname === item.href || pathname.startsWith(`${item.href}/`)) && styles.phoneLinkActive)}
            >
              {item.label}
            </Link>
          ))}
          <button className={styles.phoneLink} type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            More
          </button>
        </nav>
      ) : null}
    </div>
  );
}
