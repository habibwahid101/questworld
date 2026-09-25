"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";
import type { NavItem } from "@/types";
import { classNames } from "@/utils/format";
import styles from "./AppShell.module.css";

type AppShellProps = {
  title: string;
  homeHref: string;
  items: readonly NavItem[];
  children: React.ReactNode;
};

export function AppShell({ title, homeHref, items, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <strong>{title}</strong>
          <button
            className={styles.menuButton}
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
        {open ? (
          <nav className={styles.mobileNav} aria-label={`${title} mobile`}>
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
