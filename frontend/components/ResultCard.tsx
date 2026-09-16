import Link from "next/link";
import { Result } from "@/lib/types";
import { formatGameDate, formatMargin, pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";
import HitBadge from "./HitBadge";

export default function ResultCard({ result, sport }: { result: Result; sport: string }) {
  const r = result;
  const confidence = pickConfidence(r);
  const homeWon = r.actual_winner === r.home_team;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{formatGameDate(r.game_date)}</span>
        <HitBadge hit={r.hit} />
      </div>

      {/* Away team on top, home team below -- the standard scoreboard
          convention, and it sidesteps squeezing long names against a
          center-aligned score. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <TeamBadge team={r.away_team} sport={sport} size="sm" />
          <Link
            href={`/teams/${encodeURIComponent(r.away_team)}?sport=${sport}`}
            className={`flex-1 truncate text-sm hover:text-indigo-600 dark:hover:text-indigo-400 ${!homeWon ? "font-bold" : "text-neutral-500 dark:text-neutral-400"}`}
          >
            {r.away_team}
          </Link>
          <span className="text-sm font-bold tabular-nums">{r.away_score}</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamBadge team={r.home_team} sport={sport} size="sm" />
          <Link
            href={`/teams/${encodeURIComponent(r.home_team)}?sport=${sport}`}
            className={`flex-1 truncate text-sm hover:text-indigo-600 dark:hover:text-indigo-400 ${homeWon ? "font-bold" : "text-neutral-500 dark:text-neutral-400"}`}
          >
            {r.home_team}
          </Link>
          <span className="text-sm font-bold tabular-nums">{r.home_score}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-900">
        <div>
          <div className="text-neutral-400">Predicted</div>
          <div className="mt-0.5 font-semibold text-neutral-800 dark:text-neutral-200">
            {r.predicted_winner} ({Math.round(confidence * 100)}%), {formatMargin(r.predicted_margin)}
          </div>
        </div>
        <div>
          <div className="text-neutral-400">Actual</div>
          <div className="mt-0.5 font-semibold text-neutral-800 dark:text-neutral-200">
            {r.actual_winner}, {formatMargin(r.actual_margin)}
          </div>
        </div>
      </div>

      <Link
        href={`/games/${r.game_id}?sport=${sport}`}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
      >
        Why? →
      </Link>
    </div>
  );
}
