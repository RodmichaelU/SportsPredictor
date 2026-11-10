import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { getSports } from "@/lib/api";
import LeagueNav from "@/components/LeagueNav";
import SecondaryNav from "@/components/SecondaryNav";
import Logo from "@/components/Logo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Barlow_Condensed({
  variable: "--font-display-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Sports Predictor", template: "%s — Sports Predictor" },
  description: "ML-driven win probability and margin predictions, explained in plain English",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sports = await getSports();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-clip bg-background text-neutral-900 dark:text-neutral-100">
        <header className="sticky top-0 z-20 bg-ink-950 text-white shadow-[0_2px_0_0_var(--color-brand-600)]">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6">
            <Link href="/" className="flex items-center gap-2.5 py-3">
              <Logo className="h-8 w-8" />
              <span className="display text-2xl leading-none">
                Sports<span className="text-brand-500">Predictor</span>
              </span>
            </Link>
            <Suspense fallback={<div className="h-5 w-56" />}>
              <LeagueNav sports={sports} />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <SecondaryNav />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
        <footer className="bg-ink-950 px-6 py-8 text-neutral-400">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo className="h-6 w-6" />
              <span className="display text-lg text-white">
                Sports<span className="text-brand-500">Predictor</span>
              </span>
            </Link>
            <span className="text-xs">Built for research and entertainment. Not betting advice.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
