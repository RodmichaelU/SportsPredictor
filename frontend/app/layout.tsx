import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Sports Predictor",
  description: "ML-driven win probability and margin predictions, explained in plain English",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sports = await getSports();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="text-lg font-semibold tracking-tight">Sports Predictor</span>
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
        <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-400 dark:border-neutral-800">
          Built for research and entertainment. Not betting advice.
        </footer>
      </body>
    </html>
  );
}
