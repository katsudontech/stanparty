import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
import "./theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "StanParty｜待ち時間を、遊ぶ時間に。",
    template: "%s｜StanParty",
  },
  description: "スマホひとつで友達と遊べる、リアルタイムのパーティゲーム。アカウント登録なしですぐに始められます。",
  applicationName: "StanParty",
  openGraph: {
    title: "StanParty｜待ち時間を、遊ぶ時間に。",
    description: "スマホひとつで友達と遊べる、リアルタイムのパーティゲーム。アカウント登録なしですぐに始められます。",
    url: "/",
    siteName: "StanParty",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StanParty｜待ち時間を、遊ぶ時間に。",
    description: "スマホひとつで友達と遊べる、リアルタイムのパーティゲーム。アカウント登録なしですぐに始められます。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
