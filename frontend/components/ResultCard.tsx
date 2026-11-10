import Link from "next/link";
import { Result } from "@/lib/types";
import { formatGameDate, formatMargin, pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";
import HitBadge from "./HitBadge";

function ScoreRow({ team, score, won, sport }: { team: string; score: number; won: boolean; sport: string }) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge team={team} sport={sport} size="md" />
      <Link
        href={`/teams/${encodeURIComponent(team)}?sport=${sport}`}
        className={`flex-1 truncate text-[15px] hover:text-brand-600 dark:hover:text-brand-400 ${
          won ? "font-bold" : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        {team}
      </Link>
      {won && (
        <span className="h-0 w-0 border-y-[5px] border-r-[7px] border-y-transparent border-r-neutral-900 dark:border-r-white" aria-label="Winner" />
      )}
      <span className={`display w-12 text-right text-3xl tabular-nums ${won ? "" : "text-neutral-400 dark:text-neutral-500"}`}>
        {score}
      </span>
    </div>
  );
}

export default function ResultCard({ result, sport }: { result: Result; sport: string }) {
  const r = result;
  const confidence = pickConfidence(r);
  const homeWon = r.actual_winner === r.home_team;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-ink-900">
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-2 dark:border-white/5 dark:bg-ink-800">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
          Final · {formatGameDate(r.game_date)}
        </span>
        <HitBadge hit={r.hit} />
      </div>

      {/* Away team on top, home team below -- the standard scoreboard
          convention, and it sidesteps squeezing long names against a
          center-aligned score. */}
      <div className="flex flex-col gap-2.5 px-4 py-4">
        <ScoreRow team={r.away_team} score={r.away_score} won={!homeWon} sport={sport} />
        <ScoreRow team={r.home_team} score={r.home_score} won={homeWon} sport={sport} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-2.5 text-xs dark:border-white/5">
        <div className="min-w-0">
          <span className="eyebrow mr-1.5 text-[10px] text-neutral-400">Pick</span>
          <span className="font-semibold">
            {r.predicted_winner} ({Math.round(confidence * 100)}%), {formatMargin(r.predicted_margin)}
          </span>
        </div>
        <Link
          href={`/games/${r.game_id}?sport=${sport}`}
          className="eyebrow shrink-0 text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          Why? ›
        </Link>
      </div>
    </div>
  );
}
