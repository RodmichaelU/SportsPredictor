import Link from "next/link";
import { ValueBet } from "@/lib/valueBets";
import TeamBadge from "./TeamBadge";

// A compact horizontal-scroll strip of this week's best value bets -- the
// games where our model and the live market disagree most, weighted by
// expected return rather than raw probability gap (see lib/valueBets.ts).
export default function GameTicker({ picks, sport }: { picks: ValueBet[]; sport: string }) {
  if (picks.length === 0) return null;

  return (
    // The browser's own horizontal scrollbar track read as a stray line
    // cutting across the hero section -- hidden via .no-scrollbar, but the
    // strip still scrolls fine with touch/trackpad/drag.
    <div className="no-scrollbar w-full overflow-x-auto">
      <div className="mx-auto flex w-max gap-3 px-6 pb-2">
        {picks.map(({ prediction: p, team, modelProb, marketProb, roi }) => (
          <Link
            key={p.game_id}
            href={`/games/${p.game_id}?sport=${sport}`}
            className="flex w-44 shrink-0 flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-1.5">
              <TeamBadge team={p.away_team} sport={sport} size="sm" />
              <span
                className={`truncate text-xs ${team === p.away_team ? "font-semibold text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}`}
              >
                {p.away_team}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <TeamBadge team={p.home_team} sport={sport} size="sm" />
              <span
                className={`truncate text-xs ${team === p.home_team ? "font-semibold text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}`}
              >
                {p.home_team}
              </span>
            </div>
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {team} {Math.round(modelProb * 100)}%
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              vs {Math.round(marketProb * 100)}% mkt · +{Math.round(roi * 100)}% value
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
