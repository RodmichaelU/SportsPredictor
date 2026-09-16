import Link from "next/link";
import { Prediction } from "@/lib/types";
import { formatGameDate, formatPercent } from "@/lib/format";
import TeamBadge from "./TeamBadge";

function ProbabilityRow({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 shrink-0 text-neutral-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full ${colorClass}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-semibold tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}

// The games where our model and Kalshi's real-money market see the home
// team's odds most differently -- either we know something the market
// doesn't yet, or vice versa. Both bars are the same quantity (home team win
// probability) so the gap between them is a direct, honest read, not a
// reframed "confidence in the pick" number.
export default function MarketDisagreements({ predictions, sport }: { predictions: Prediction[]; sport: string }) {
  const ranked = predictions
    .filter((p): p is Prediction & { market_home_probability: number } => p.market_home_probability !== null)
    .map((p) => ({ prediction: p, gap: Math.abs(p.win_probability - p.market_home_probability) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  if (ranked.length === 0) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 text-sm font-semibold">Where we disagree most with the market</div>
      <p className="mb-4 max-w-2xl text-sm text-neutral-500">
        Both bars are the same thing -- the home team&apos;s win probability -- one from our model, one from
        Kalshi&apos;s live, real-money market. A big gap means one side thinks it knows something the other
        doesn&apos;t.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ranked.map(({ prediction: p, gap }) => (
          <Link
            key={p.game_id}
            href={`/games/${p.game_id}?sport=${sport}`}
            className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 transition-shadow hover:shadow-md dark:border-neutral-800"
          >
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{formatGameDate(p.game_date)}</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {Math.round(gap * 100)} pt gap
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <TeamBadge team={p.away_team} sport={sport} size="sm" />
                {p.away_team}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <TeamBadge team={p.home_team} sport={sport} size="sm" />
                {p.home_team}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <ProbabilityRow label="Model" value={p.win_probability} colorClass="bg-indigo-600" />
              <ProbabilityRow label="Market" value={p.market_home_probability} colorClass="bg-neutral-500" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
