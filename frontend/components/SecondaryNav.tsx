"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/predictions", label: "Predictions" },
  { href: "/results", label: "Results" },
  { href: "/model", label: "Model" },
];

// A visually distinct strip from the primary header above it -- section-level
// tabs (like a document's own navigation) rather than another row of
// site-level nav buttons. Returns nothing at all on the home page, where it
// doesn't apply, rather than rendering an empty bordered strip.
export default function SecondaryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  if (pathname === "/") return null;

  return (
    <div className="border-t border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="mx-auto flex w-full max-w-6xl gap-5 px-6">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={query ? `${tab.href}?${query}` : tab.href}
              className={`border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
