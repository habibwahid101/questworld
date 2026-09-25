import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      description="Platform settings will be added after infrastructure and operations requirements are approved."
    />
  );
}
