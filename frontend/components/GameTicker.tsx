import Link from "next/link";
import { Prediction } from "@/lib/types";
import { pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";

// A compact horizontal-scroll strip of upcoming games -- the pattern every
// sports app leads with (ESPN, theScore, etc. all open on a scores strip).
export default function GameTicker({ predictions, sport }: { predictions: Prediction[]; sport: string }) {
  if (predictions.length === 0) return null;

  return (
    // The browser's own horizontal scrollbar track read as a stray line
    // cutting across the hero section -- hidden via .no-scrollbar, but the
    // strip still scrolls fine with touch/trackpad/drag.
    <div className="no-scrollbar w-full overflow-x-auto">
      <div className="mx-auto flex w-max gap-3 px-6 pb-2">
        {predictions.map((p) => {
          const confidence = Math.round(pickConfidence(p) * 100);
          return (
            <Link
              key={p.game_id}
              href={`/games/${p.game_id}?sport=${sport}`}
              className="flex w-40 shrink-0 flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-center gap-1.5">
                <TeamBadge team={p.away_team} sport={sport} size="sm" />
                <span className="truncate text-xs text-neutral-600 dark:text-neutral-400">{p.away_team}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TeamBadge team={p.home_team} sport={sport} size="sm" />
                <span className="truncate text-xs text-neutral-600 dark:text-neutral-400">{p.home_team}</span>
              </div>
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {p.predicted_winner} {confidence}%
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
