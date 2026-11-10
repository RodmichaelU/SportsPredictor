"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/predictions", label: "Predictions" },
  { href: "/results", label: "Results" },
  { href: "/standings", label: "Standings" },
  { href: "/teams", label: "Teams" },
  { href: "/model", label: "Model" },
];

// A visually distinct strip from the primary header above it -- section-level
// tabs (like a document's own navigation) rather than another row of
// site-level nav buttons. Returns nothing at all on the home page and the
// cross-league Parlay Picker, where it doesn't apply, rather than rendering
// an empty bordered strip.
export default function SecondaryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  if (pathname === "/" || pathname === "/parlays") return null;

  return (
    <div className="bg-ink-800">
      <div className="no-scrollbar scroll-fade mx-auto flex w-full max-w-6xl gap-6 overflow-x-auto px-4 sm:px-6">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={query ? `${tab.href}?${query}` : tab.href}
              className={`shrink-0 border-b-2 py-2.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-white text-white"
                  : "border-transparent text-neutral-400 hover:text-white"
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
