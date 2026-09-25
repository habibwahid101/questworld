import type { Metadata } from "next";
import { brand } from "@/constants/site";
import { siteMetadataBase } from "@/utils/metadata";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteMetadataBase,
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description:
    "Choose an investment plan, manage your portfolio, track applicable monthly earnings, and benefit from a simple two-generation referral program.",
  applicationName: brand.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: brand.name,
    description:
      "Listed investment plans from $100, monthly earnings tracking, and a two-generation referral program.",
    siteName: brand.name,
    type: "website",
    url: "/",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
