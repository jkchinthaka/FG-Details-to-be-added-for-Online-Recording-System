import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nelna FG Digital Recording System",
    template: "%s · Nelna FG",
  },
  description:
    "Mobile-first Finished Goods and QA digital recording for Nelna Farm — exception-based cleaning verification and freezer truck inspection.",
  applicationName: "Nelna FG Digital Recording System",
  authors: [{ name: "Chinthaka Jayaweera" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nelna FG",
  },
};

export const viewport: Viewport = {
  themeColor: "#27743A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const bodyStyle = {
    ["--nelna-font-sans"]: "var(--font-source-sans), 'Source Sans 3', sans-serif",
    ["--nelna-font-display"]: "var(--font-fraunces), Fraunces, Georgia, serif",
  } as CSSProperties;

  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable}`}>
      <body style={bodyStyle}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
