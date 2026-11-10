"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sport } from "@/lib/types";

// League tabs sit on the dark header: condensed uppercase labels with a
// full-height red underline on the active league, like a broadcast nav bar.
function linkClass(active: boolean) {
  return `-mb-px flex h-14 shrink-0 items-center whitespace-nowrap border-b-[3px] font-[family-name:var(--font-display)] text-[15px] font-bold tracking-wider uppercase transition-colors ${
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

  return (
    <nav className="no-scrollbar flex items-center gap-6 overflow-x-auto">
      <Link href="/" className={linkClass(onHome)}>
        Home
      </Link>
      {sports.map((sport) => (
        <Link
          key={sport.id}
          href={`/predictions?sport=${sport.id}`}
          className={`inline-flex items-center gap-1.5 ${linkClass(!onHome && currentSport === sport.id)}`}
        >
          {sport.name}
          {sport.status === "coming_soon" && (
            <span className="rounded-sm bg-white/10 px-1.5 py-0.5 font-sans text-[9px] font-semibold tracking-wide text-neutral-300 uppercase">
              Soon
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
