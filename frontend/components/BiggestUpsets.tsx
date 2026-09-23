import Link from "next/link";
import { Result } from "@/lib/types";
import { rankByUpset } from "@/lib/upsets";
import { formatGameDate, formatPercent } from "@/lib/format";
import TeamBadge from "./TeamBadge";

// The flip side of MarketDisagreements: not "where might we be wrong", but
// "where we already were", ranked by how confident the model was in the
// pick that lost. A 51% pick losing is a coin flip going the other way; a
// 90%+ pick losing is the model getting caught flat-footed.
export default function BiggestUpsets({ results, sport }: { results: Result[]; sport: string }) {
  const upsets = rankByUpset(results).slice(0, 3);
  if (upsets.length === 0) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 text-sm font-semibold">Biggest upsets</div>
      <p className="mb-4 max-w-2xl text-sm text-neutral-500">
        Completed games the model was most confident about -- and got wrong. Ranked by how sure it was,
        not by final score.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {upsets.map(({ result: r, confidence }) => {
          const homeWon = r.actual_winner === r.home_team;
          return (
            <Link
              key={r.game_id}
              href={`/games/${r.game_id}?sport=${sport}`}
              className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 transition-shadow hover:shadow-md dark:border-neutral-800"
            >
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{formatGameDate(r.game_date)}</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {formatPercent(confidence)} confidence miss
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs">
                  <TeamBadge team={r.away_team} sport={sport} size="sm" />
                  <span className={!homeWon ? "font-semibold text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}>
                    {r.away_team}
                  </span>
                  <span className="ml-auto font-bold tabular-nums">{r.away_score}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <TeamBadge team={r.home_team} sport={sport} size="sm" />
                  <span className={homeWon ? "font-semibold text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}>
                    {r.home_team}
                  </span>
                  <span className="ml-auto font-bold tabular-nums">{r.home_score}</span>
                </div>
              </div>
              <div className="border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-900">
                Predicted {r.predicted_winner} ({formatPercent(confidence)}) -- {r.actual_winner} won by{" "}
                {Math.round(Math.abs(r.actual_margin))} instead
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
