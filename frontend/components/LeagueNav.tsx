"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sport } from "@/lib/types";

// League tabs sit on the dark header: condensed uppercase labels with a
// full-height red underline on the active league, like a broadcast nav bar.
function linkClass(active: boolean) {
  return `-mb-px flex h-12 shrink-0 sm:h-14 items-center whitespace-nowrap border-b-[3px] font-[family-name:var(--font-display)] text-[15px] font-bold tracking-wider uppercase transition-colors ${
    active
      ? "border-brand-500 text-white"
      : "border-transparent text-neutral-400 hover:text-white"
  }`;
}

export default function LeagueNav({ sports }: { sports: Sport[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSport = searchParams.get("sport");
  const onHome = pathname === "/";
  // The Parlay Picker takes ?sport= as a filter too, but it's its own
  // destination -- a league tab shouldn't light up there.
  const onParlays = pathname === "/parlays";

  return (
    <nav className="no-scrollbar scroll-fade -mx-4 flex w-[calc(100%+2rem)] items-center gap-6 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
      <Link href="/" className={linkClass(onHome)}>
        Home
      </Link>
      {sports.map((sport) => (
        <Link
          key={sport.id}
          href={`/predictions?sport=${sport.id}`}
          className={`inline-flex items-center gap-1.5 ${linkClass(!onHome && !onParlays && currentSport === sport.id)}`}
        >
          {sport.name}
          {sport.status === "coming_soon" && (
            <span className="rounded-sm bg-white/10 px-1.5 py-0.5 font-sans text-[9px] font-semibold tracking-wide text-neutral-300 uppercase">
              Soon
            </span>
          )}
        </Link>
      ))}
      <Link
        href="/parlays"
        className={`eyebrow shrink-0 rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors ${
          onParlays ? "bg-brand-600 text-white" : "bg-white/10 text-white hover:bg-brand-600"
        }`}
      >
        Parlay Picker
      </Link>
    </nav>
  );
}
