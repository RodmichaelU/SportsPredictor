"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sport } from "@/lib/types";

function linkClass(active: boolean) {
  return `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-indigo-600 text-white"
      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
  }`;
}

export default function LeagueNav({ sports }: { sports: Sport[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSport = searchParams.get("sport");
  const onHome = pathname === "/";

  return (
    <nav className="flex flex-wrap items-center gap-1">
      <Link href="/" className={linkClass(onHome)}>
        Home
      </Link>
      {sports.map((sport) => (
        <Link
          key={sport.id}
          href={`/predictions?sport=${sport.id}`}
          className={linkClass(!onHome && currentSport === sport.id)}
        >
          {sport.name}
        </Link>
      ))}
    </nav>
  );
}
