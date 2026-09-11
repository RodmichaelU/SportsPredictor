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
    <div className="border-b border-neutral-100 py-3 last:border-0 dark:border-neutral-900">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="w-48 shrink-0 text-sm text-neutral-700 dark:text-neutral-300">{group.label}</div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`w-40 shrink-0 text-right text-sm font-medium ${textColor}`}>
          Favors {group.favored_team}
        </div>
        <span className="w-4 shrink-0 text-center text-xs text-neutral-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="mt-2 ml-[13.5rem] flex flex-col gap-1 text-xs text-neutral-500">
          {group.details.map((detail, i) => (
            <li key={i}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
