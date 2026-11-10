"use client";

import { useState } from "react";
import { ExplanationGroup } from "@/lib/types";

export default function ExplanationFactor({
  group,
  homeTeam,
  maxAbsContribution,
}: {
  group: ExplanationGroup;
  homeTeam: string;
  maxAbsContribution: number;
}) {
  const [open, setOpen] = useState(false);
  const favorsHome = group.favored_team === homeTeam;
  const pct = maxAbsContribution > 0 ? Math.round((Math.abs(group.contribution) / maxAbsContribution) * 100) : 0;
  const color = favorsHome ? "bg-sky-600" : "bg-amber-500";
  const textColor = favorsHome ? "text-sky-700 dark:text-sky-400" : "text-amber-700 dark:text-amber-400";

  return (
    <div className="border-b border-neutral-100 py-3 last:border-0 dark:border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 text-left sm:flex-nowrap"
      >
        <div className="min-w-0 flex-1 text-sm text-neutral-700 sm:w-48 sm:flex-none sm:shrink-0 dark:text-neutral-300">{group.label}</div>
        <div className="order-last h-2 w-full overflow-hidden rounded-full bg-neutral-100 sm:order-none sm:w-auto sm:flex-1 dark:bg-white/10">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`shrink-0 truncate text-right text-xs font-semibold sm:w-40 sm:text-sm ${textColor}`}>
          Favors {group.favored_team}
        </div>
        <span className="w-4 shrink-0 text-center text-xs text-neutral-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="mt-2 flex sm:ml-[13.5rem] flex-col gap-1 text-xs text-neutral-500">
          {group.details.map((detail, i) => (
            <li key={i}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
