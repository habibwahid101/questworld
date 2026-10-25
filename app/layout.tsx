import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { brand } from "@/constants/site";
import { shareImage, siteMetadataBase } from "@/utils/metadata";
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
    images: [{ url: shareImage, width: 1000, height: 300, alt: brand.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description:
      "Listed investment plans from $100, monthly earnings tracking, and a two-generation referral program.",
    images: [shareImage],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
