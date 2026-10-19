import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 首頁主標專用（font-home-display）。中文字型沒有可預先載入的子集，所以 preload 關閉，
// 只有實際用到這個字型的畫面才會下載需要的字。
const notoSansTc = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  weight: "800",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "飛索・瑜伽團課共創平台",
    template: "%s｜飛索",
  },
  description:
    "飛索是品牌導向的瑜伽團課 marketplace，連結團主、瑜伽老師與學員，共創清楚、安心且高品質的身心練習。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansTc.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
