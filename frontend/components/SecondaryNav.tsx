"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parsePath, SECTIONS } from "@/lib/routes";

const LABELS: Record<(typeof SECTIONS)[number], string> = {
  predictions: "Predictions",
  results: "Results",
  standings: "Standings",
  teams: "Teams",
  model: "Model",
};

// A visually distinct strip from the primary header above it -- section-level
// tabs (like a document's own navigation) rather than another row of
// site-level nav buttons. Each tab keeps the current league (/results/nba/ ->
// /standings/nba/). Returns nothing on the home page and the cross-league
// Parlay Picker, where it doesn't apply, rather than an empty bordered strip.
export default function SecondaryNav({ defaultSport }: { defaultSport: string }) {
  const pathname = usePathname();
  const { section, sport } = parsePath(pathname);

  if (section === null || section === "parlays") return null;
  const league = sport ?? defaultSport;

  return (
    <div className="bg-ink-800">
      <div className="no-scrollbar mx-auto flex w-full max-w-6xl gap-5 overflow-x-auto px-4 sm:gap-6 sm:px-6">
        {SECTIONS.map((tab) => {
          const active = section === tab;
          return (
            <Link
              key={tab}
              href={`/${tab}/${league}/`}
              className={`shrink-0 border-b-2 py-2.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-white text-white"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              {LABELS[tab]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
