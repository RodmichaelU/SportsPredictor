import Link from "next/link";
import { Prediction } from "@/lib/types";
import { formatGameDate, formatMargin, formatPercent, marketConfidence, pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";

// Scoreboard-style row: where a score would go, each team shows its own
// model win probability, with the picked side in full ink and a red marker.
function TeamRow({
  team,
  probability,
  isPick,
  sport,
}: {
  team: string;
  probability: number;
  isPick: boolean;
  sport: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge team={team} sport={sport} size="md" />
      <Link
        href={`/teams/${encodeURIComponent(team)}?sport=${sport}`}
        className={`flex-1 truncate text-[15px] hover:text-brand-600 dark:hover:text-brand-400 ${
          isPick ? "font-bold" : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        {team}
      </Link>
      {isPick && (
        <span className="h-0 w-0 border-y-[5px] border-r-[7px] border-y-transparent border-r-brand-600" aria-label="Model pick" />
      )}
      <span
        className={`display w-14 text-right text-3xl tabular-nums ${
          isPick ? "" : "text-neutral-400 dark:text-neutral-500"
        }`}
      >
        {formatPercent(probability)}
      </span>
    </div>
  );
}

export default function PredictionCard({ prediction, sport }: { prediction: Prediction; sport: string }) {
  const p = prediction;
  const confidence = pickConfidence(p);
  const market = marketConfidence(p);
  const homeIsPick = p.predicted_winner === p.home_team;
  const edge = market !== null ? confidence - market : null;

  return (
    <div className="group flex flex-col overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-ink-900">
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-2 dark:border-white/5 dark:bg-ink-800">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
          {formatGameDate(p.game_date)}
        </span>
        <Link
          href={`/games/${p.game_id}?sport=${sport}`}
          className="eyebrow text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          Why? ›
        </Link>
      </div>

      {/* Away team on top, home team below -- the standard scoreboard
          convention, and it gives long team names the full card width
          instead of squeezing two names either side of a divider. */}
      <div className="flex flex-col gap-2.5 px-4 py-4">
        <TeamRow team={p.away_team} probability={homeIsPick ? 1 - confidence : confidence} isPick={!homeIsPick} sport={sport} />
        <TeamRow team={p.home_team} probability={homeIsPick ? confidence : 1 - confidence} isPick={homeIsPick} sport={sport} />
      </div>

      <div className="mt-auto grid grid-cols-3 divide-x divide-neutral-100 border-t border-neutral-100 text-center dark:divide-white/5 dark:border-white/5">
        <div className="px-2 py-2.5">
          <div className="eyebrow text-[10px] text-neutral-400">Market</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">{market !== null ? formatPercent(market) : "—"}</div>
        </div>
        <div className="px-2 py-2.5">
          <div className="eyebrow text-[10px] text-neutral-400">Edge</div>
          <div
            className={`mt-0.5 text-sm font-bold tabular-nums ${
              edge === null ? "" : edge > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500"
            }`}
          >
            {edge === null ? "—" : `${edge > 0 ? "+" : ""}${Math.round(edge * 100)}`}
          </div>
        </div>
        <div className="px-2 py-2.5">
          <div className="eyebrow text-[10px] text-neutral-400">Margin</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">{formatMargin(p.predicted_margin)}</div>
        </div>
      </div>
    </div>
  );
}
