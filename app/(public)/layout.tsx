import { PublicLayout } from "@/components/layouts/PublicLayout";

export default function PublicSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayout>{children}</PublicLayout>;
}
