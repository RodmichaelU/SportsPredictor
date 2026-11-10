import Link from "next/link";
import { Prediction } from "@/lib/types";
import { formatGameDate, formatPercent, marketConfidence, pickConfidence } from "@/lib/format";
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
      <span className={`flex-1 truncate text-[15px] ${isPick ? "font-bold" : "text-neutral-500 dark:text-neutral-400"}`}>{team}</span>
      {isPick && (
        <span className="h-0 w-0 border-y-[5px] border-r-[7px] border-y-transparent border-r-brand-600" aria-label="Model pick" />
      )}
      <span className={`display w-14 text-right text-3xl tabular-nums ${isPick ? "" : "text-neutral-400 dark:text-neutral-500"}`}>
        {formatPercent(probability)}
      </span>
    </div>
  );
}

// One game. The whole card links to its "Why?" page; the footer is a single
// plain-English line (projected margin, plus the market price when one
// exists) instead of a grid of mostly-empty stat cells.
export default function PredictionCard({ prediction, sport }: { prediction: Prediction; sport: string }) {
  const p = prediction;
  const confidence = pickConfidence(p);
  const market = marketConfidence(p);
  const homeIsPick = p.predicted_winner === p.home_team;
  const pickMargin = Math.abs(Math.round(p.predicted_margin * 10) / 10);

  return (
    <Link
      href={`/games/${p.game_id}?sport=${sport}`}
      className="group flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-neutral-200/70 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg dark:bg-ink-900 dark:ring-white/10"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{formatGameDate(p.game_date)}</span>
        <span className="eyebrow text-[11px] text-neutral-400 transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
          Why ›
        </span>
      </div>

      {/* Away team on top, home team below -- the standard scoreboard
          convention, and it gives long team names the full card width
          instead of squeezing two names either side of a divider. */}
      <div className="flex flex-col gap-2.5">
        <TeamRow team={p.away_team} probability={homeIsPick ? 1 - confidence : confidence} isPick={!homeIsPick} sport={sport} />
        <TeamRow team={p.home_team} probability={homeIsPick ? confidence : 1 - confidence} isPick={homeIsPick} sport={sport} />
      </div>

      <p className="border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-white/5">
        {p.predicted_winner} by <span className="font-semibold text-neutral-800 dark:text-neutral-200">{pickMargin}</span>
        {market !== null && (
          <>
            {" "}· Market <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatPercent(market)}</span>
          </>
        )}
      </p>
    </Link>
  );
}
