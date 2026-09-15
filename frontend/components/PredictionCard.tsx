import Link from "next/link";
import { Prediction } from "@/lib/types";
import { formatGameDate, formatMargin, formatPercent, marketConfidence, pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";
import ConfidenceBar from "./ConfidenceBar";

export default function PredictionCard({ prediction, sport }: { prediction: Prediction; sport: string }) {
  const p = prediction;
  const confidence = pickConfidence(p);
  const market = marketConfidence(p);
  const homeIsPick = p.predicted_winner === p.home_team;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{formatGameDate(p.game_date)}</span>
        <Link
          href={`/games/${p.game_id}?sport=${sport}`}
          className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          Why? →
        </Link>
      </div>

      {/* Away team on top, home team below -- the standard scoreboard
          convention, and it gives long team names the full card width
          instead of squeezing two names either side of a divider. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <TeamBadge team={p.away_team} size="sm" />
          <span className={`flex-1 text-sm ${!homeIsPick ? "font-bold" : "text-neutral-500 dark:text-neutral-400"}`}>
            {p.away_team}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TeamBadge team={p.home_team} size="sm" />
          <span className={`flex-1 text-sm ${homeIsPick ? "font-bold" : "text-neutral-500 dark:text-neutral-400"}`}>
            {p.home_team}
          </span>
        </div>
      </div>

      <ConfidenceBar confidence={confidence} />

      <div className="grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-900">
        <div>
          <div className="text-neutral-400">Model</div>
          <div className="mt-0.5 font-semibold text-neutral-800 dark:text-neutral-200">
            {formatPercent(confidence)}
          </div>
        </div>
        <div>
          <div className="text-neutral-400">Market</div>
          <div className="mt-0.5 font-semibold text-neutral-800 dark:text-neutral-200">
            {market !== null ? formatPercent(market) : "—"}
          </div>
        </div>
        <div>
          <div className="text-neutral-400">Margin</div>
          <div className="mt-0.5 font-semibold text-neutral-800 dark:text-neutral-200">
            {formatMargin(p.predicted_margin)}
          </div>
        </div>
      </div>
    </div>
  );
}
