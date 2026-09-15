"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sport } from "@/lib/types";

function linkClass(active: boolean) {
  return `border-b-2 pb-0.5 text-sm font-medium transition-colors ${
    active
      ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
      : "border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
  }`;
}

export default function LeagueNav({ sports }: { sports: Sport[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSport = searchParams.get("sport");
  const onHome = pathname === "/";

  return (
    <nav className="flex flex-wrap items-center gap-5">
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
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase dark:bg-neutral-800 dark:text-neutral-400">
              Soon
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
