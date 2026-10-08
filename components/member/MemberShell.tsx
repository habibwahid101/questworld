import { AppShell } from "@/components/layouts/AppShell";
import { memberNav } from "@/constants/site";

export function MemberShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Member" homeHref="/dashboard" items={memberNav} showPhoneBar>
      {children}
    </AppShell>
  );
}
