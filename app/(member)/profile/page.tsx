import type { Metadata } from "next";
import { ProfilePanel } from "@/components/member/ProfilePanel";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return <ProfilePanel />;
}
