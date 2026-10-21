"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layouts/AppShell";
import { memberNav } from "@/constants/site";

export function MemberShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AppShell title="Member" pageLabel={pathname === "/dashboard" ? "Dashboard" : undefined} homeHref="/dashboard" items={memberNav} showPhoneBar>
      {children}
    </AppShell>
  );
}

