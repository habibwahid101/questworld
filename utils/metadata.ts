import type { Metadata } from "next";
import { brand } from "@/constants/site";

const PRODUCTION_ORIGIN = "https://main.d1xja8a1py5jgx.amplifyapp.com";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_ORIGIN;

export const siteMetadataBase = new URL(siteUrl);
export const shareImage = "/icon.png";

const shareImages = [{ url: shareImage, width: 1024, height: 1024, alt: brand.name }];

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
      images: shareImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${brand.name}`,
      description,
      images: [shareImage],
    },
  };
}
