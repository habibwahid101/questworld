import type { Metadata } from "next";
import { brand } from "@/constants/site";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const siteMetadataBase = new URL(siteUrl);

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path, siteMetadataBase).toString();

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${title} · ${brand.name}`,
      description,
      url,
      siteName: brand.name,
      type: "website",
    },
  };
}
