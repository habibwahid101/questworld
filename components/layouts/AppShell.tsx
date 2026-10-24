"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { adminSwitchTarget } from "@/lib/auth/shell";
import { BrandMark } from "@/components/ui/BrandMark";
import { readCurrentMember, readCurrentProfilePhoto } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { NavItem } from "@/types";
import { classNames } from "@/utils/format";
import styles from "./AppShell.module.css";

type AppShellProps = {
  title: string;
  pageLabel?: string;
  homeHref: string;
  items: readonly NavItem[];
  children: React.ReactNode;
};

export function AppShell({ title, pageLabel, homeHref, items, children }: AppShellProps) {
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
          <div className={styles.brandLockup}>
            <BrandMark href={homeHref} />
            <span className={styles.subtitle}>REAL ESTATE & INVESTMENT</span>
            {pageLabel ? <span className="sr-only">{pageLabel}</span> : null}
          </div>
          <div className={styles.topActions}>
            <HeaderClock />
            <button className={styles.iconButton} type="button" aria-label="Notifications">
              <BellIcon />
            </button>
            <HeaderAvatar />
            {shellSwitch ? (
              <Link className={styles.logoutButton} href={shellSwitch.href}>
                {shellSwitch.label}
              </Link>
            ) : null}
            <button className={classNames(styles.logoutButton, styles.topLogout)} type="button" onClick={() => void onLogout()} disabled={signingOut} aria-busy={signingOut}>
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
            <button className={styles.mobileLogout} type="button" onClick={() => void onLogout()} disabled={signingOut} aria-busy={signingOut}>
              {signingOut ? "Please wait…" : "Log out"}
            </button>
          </nav>
        ) : null}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

function HeaderClock() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const tick = () => setLabel(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time className={styles.clock} dateTime={label}>
      {label}
    </time>
  );
}

function HeaderAvatar() {
  const { user } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const initial = (user?.name || user?.email || "Q").trim().charAt(0).toUpperCase() || "Q";

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void readCurrentMember()
      .then(async (profile) => {
        if (!active || !profile.hasProfilePhoto) {
          return;
        }
        const photo = await readCurrentProfilePhoto();
        if (active && photo) {
          setSrc(`data:${photo.contentType};base64,${photo.dataBase64}`);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return src ? (
    // Member photos are private data URLs, so they are not passed through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.avatar} src={src} alt="" />
  ) : (
    <span className={styles.avatar} aria-hidden="true">
      {initial}
    </span>
  );
}

function BellIcon() {
  return (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 16h12l-1.2-2.2a6 6 0 0 1-.8-3V9a4 4 0 1 0-8 0v1.8a6 6 0 0 1-.8 3L6 16z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M10 17a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
