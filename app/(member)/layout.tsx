import { Suspense } from "react";
import { AccessNotice } from "@/components/auth/AccessNotice";
import { RequireAuth } from "@/components/auth/AuthProvider";
import { MemberDataProvider } from "@/components/member/MemberData";
import { MemberShell } from "@/components/member/MemberShell";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <MemberShell>
        <MemberDataProvider>
          <Suspense fallback={null}>
            <AccessNotice />
          </Suspense>
          {children}
        </MemberDataProvider>
      </MemberShell>
    </RequireAuth>
  );
}
