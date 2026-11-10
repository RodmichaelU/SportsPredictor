import Link from "next/link";
import { Result } from "@/lib/types";
import { formatGameDate, pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";
import HitBadge from "./HitBadge";

function ScoreRow({ team, score, won, sport }: { team: string; score: number; won: boolean; sport: string }) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge team={team} sport={sport} size="md" />
      <span className={`flex-1 truncate text-[15px] ${won ? "font-bold" : "text-neutral-500 dark:text-neutral-400"}`}>{team}</span>
      <span className={`display w-12 text-right text-3xl tabular-nums ${won ? "" : "text-neutral-400 dark:text-neutral-500"}`}>
        {score}
      </span>
    </div>
  );
}

// A final score, with what the model picked in one line underneath. The
// whole card links to the game's "Why?" page.
export default function ResultCard({ result, sport }: { result: Result; sport: string }) {
  const r = result;
  const confidence = pickConfidence(r);
  const homeWon = r.actual_winner === r.home_team;

  return (
    <Link
      href={`/games/${r.game_id}?sport=${sport}`}
      className="group flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-neutral-200/70 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg dark:bg-ink-900 dark:ring-white/10"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
          Final · {formatGameDate(r.game_date)}
        </span>
        <HitBadge hit={r.hit} />
      </div>

      {/* Away team on top, home team below -- the standard scoreboard
          convention, and it sidesteps squeezing long names against a
          center-aligned score. */}
      <div className="flex flex-col gap-2.5">
        <ScoreRow team={r.away_team} score={r.away_score} won={!homeWon} sport={sport} />
        <ScoreRow team={r.home_team} score={r.home_score} won={homeWon} sport={sport} />
      </div>

      <p className="border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-white/5">
        Model picked <span className="font-semibold text-neutral-800 dark:text-neutral-200">{r.predicted_winner}</span> at{" "}
        {Math.round(confidence * 100)}%
      </p>
    </Link>
  );
}
