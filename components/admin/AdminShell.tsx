import { AppShell } from "@/components/layouts/AppShell";
import { adminNav } from "@/constants/site";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Admin" homeHref="/admin" items={adminNav}>
      {children}
    </AppShell>
  );
}
