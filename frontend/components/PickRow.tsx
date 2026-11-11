import Link from "next/link";
import { Prediction } from "@/lib/types";
import { formatGameDate, pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";
import { gamePath } from "@/lib/routes";

// One game as a dense list row (rank, matchup, pick, confidence meter) --
// for top-N lists and sidebars where a full PredictionCard is too big.
export default function PickRow({
  prediction,
  sport,
  rank,
  tag,
}: {
  prediction: Prediction;
  sport: string;
  rank?: number;
  tag?: string;
}) {
  const p = prediction;
  const conf = pickConfidence(p);
  const opponent = p.predicted_winner === p.home_team ? p.away_team : p.home_team;
  const atOrVs = p.predicted_winner === p.home_team ? "vs" : "@";

  return (
    <Link
      href={gamePath(sport, p.game_id)}
      className="group flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0 dark:border-white/5"
    >
      {rank !== undefined && (
        <span className="display w-6 shrink-0 text-2xl text-neutral-300 tabular-nums dark:text-neutral-600">{rank}</span>
      )}
      <TeamBadge team={p.predicted_winner} sport={sport} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold group-hover:text-brand-600 dark:group-hover:text-brand-400">{p.predicted_winner}</span>
          {tag && (
            <span className="eyebrow shrink-0 rounded-sm bg-neutral-900 px-1.5 py-px text-[9px] text-white dark:bg-white/10">{tag}</span>
          )}
        </div>
        <div className="truncate text-xs text-neutral-500">
          {atOrVs} {opponent} · {formatGameDate(p.game_date)}
        </div>
      </div>
      <div className="flex w-20 shrink-0 flex-col items-end gap-1">
        <span className="display text-2xl leading-none tabular-nums">{Math.round(conf * 100)}%</span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
          <span className="block h-full bg-brand-600" style={{ width: `${conf * 100}%` }} />
        </span>
      </div>
    </Link>
  );
}
