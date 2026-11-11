"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parlaysPath, parsePath, predictionsPath } from "@/lib/routes";
import { Sport } from "@/lib/types";
import LeagueName from "@/components/LeagueName";

// League tabs sit on the dark header: condensed uppercase labels with a
// full-height red underline on the active league, like a broadcast nav bar.
function linkClass(active: boolean) {
  return `-mb-px flex h-12 shrink-0 sm:h-14 items-center whitespace-nowrap border-b-[3px] font-[family-name:var(--font-display)] text-[15px] font-bold tracking-wider uppercase transition-colors ${
    active
      ? "border-brand-500 text-white"
      : "border-transparent text-neutral-400 hover:text-white"
  }`;
}

export default function LeagueNav({ sports, defaultSport }: { sports: Sport[]; defaultSport: string }) {
  const pathname = usePathname();
  const { section, sport } = parsePath(pathname);
  const onHome = section === null;
  // The Parlay Picker takes a league filter too (/parlays/nba/), but it's its
  // own destination -- a league tab shouldn't light up there.
  const onParlays = section === "parlays";
  // A bare section URL (/results/) shows the default league.
  const currentSport = sport ?? (onHome ? null : defaultSport);

  return (
    <nav className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] items-center gap-5 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:gap-6 sm:px-0">
      <Link href="/" className={linkClass(onHome)}>
        Home
      </Link>
      {sports.map((sport) => (
        <Link
          key={sport.id}
          href={predictionsPath(sport.id)}
          className={`inline-flex items-center gap-1.5 ${linkClass(!onHome && !onParlays && currentSport === sport.id)}`}
        >
          <LeagueName sport={sport} />
          {sport.status === "coming_soon" && (
            <span className="hidden rounded-sm bg-white/10 px-1.5 py-0.5 font-sans text-[9px] font-semibold tracking-wide text-neutral-300 uppercase sm:inline">
              Soon
            </span>
          )}
        </Link>
      ))}
      {/* Phones get ParlayShortcut beside the logo instead. */}
      <Link href={parlaysPath()} className={`hidden sm:flex ${linkClass(onParlays)}`}>
        Parlay Picker
      </Link>
    </nav>
  );
}

// The Parlay Picker on phones: beside the logo, where it's always in view,
// rather than at the far end of a league row that may scroll.
export function ParlayShortcut() {
  const { section } = parsePath(usePathname());
  return (
    <Link
      href={parlaysPath()}
      className={`eyebrow shrink-0 rounded-full px-3.5 py-2 text-[11px] whitespace-nowrap transition-colors sm:hidden ${
        section === "parlays" ? "bg-brand-600 text-white" : "bg-white/10 text-white active:bg-brand-600"
      }`}
    >
      Parlay Picker
    </Link>
  );
}
