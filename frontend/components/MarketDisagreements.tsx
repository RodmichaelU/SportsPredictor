import Link from "next/link";
import { Prediction } from "@/lib/types";
import { formatPercent } from "@/lib/format";
import SectionHeader, { Panel } from "./SectionHeader";
import TeamBadge from "./TeamBadge";

function ProbabilityRow({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 shrink-0 text-neutral-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
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
    <section>
      <SectionHeader title="Model vs. market" eyebrow="Biggest disagreements with Kalshi" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ranked.map(({ prediction: p, gap }) => (
          <Link key={p.game_id} href={`/games/${p.game_id}?sport=${sport}`} className="group">
            <Panel className="flex h-full flex-col gap-3 p-5 transition-shadow group-hover:shadow-lg">
              <div className="flex items-center gap-2">
                <TeamBadge team={p.home_team} sport={sport} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {p.home_team} <span className="font-normal text-neutral-500">vs {p.away_team}</span>
                </span>
                <span className="eyebrow shrink-0 text-[10px] text-brand-600 dark:text-brand-400">{Math.round(gap * 100)} pts</span>
              </div>
              <ProbabilityRow label="Model" value={p.win_probability} colorClass="bg-brand-600" />
              <ProbabilityRow label="Market" value={p.market_home_probability} colorClass="bg-neutral-500" />
            </Panel>
          </Link>
        ))}
      </div>
    </section>
  );
}
