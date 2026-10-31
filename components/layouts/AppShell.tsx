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
            <BrandMark href="/" />
            {pageLabel ? <span className="sr-only">{pageLabel}</span> : null}
          </div>
          <div className={styles.topActions}>
            <ThemeToggle />
            <HeaderAvatar />
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
            {shellSwitch ? (
              <Link href={shellSwitch.href} onClick={() => setOpen(false)}>
                {shellSwitch.label}
              </Link>
            ) : null}
          </nav>
        ) : null}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("qw-theme");
    const next = stored === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("qw-theme", next);
  }

  return (
    <button className={styles.menuButton} type="button" aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"} onClick={toggle}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 3.2A8.5 8.5 0 1 0 20.8 14 7 7 0 0 1 16 3.2z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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
