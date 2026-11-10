import Link from "next/link";
import { Prediction } from "@/lib/types";
import { formatGameDate, formatMargin, formatPercent, marketConfidence, pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";

function Side({ team, pct, isPick, sport, align }: { team: string; pct: number; isPick: boolean; sport: string; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <TeamBadge team={team} sport={sport} size="xl" />
      <span className={`w-full truncate text-sm font-semibold ${isPick ? "text-white" : "text-neutral-400"}`}>{team}</span>
      <span className={`display text-5xl tabular-nums sm:text-6xl ${isPick ? "text-white" : "text-neutral-600"}`}>
        {Math.round(pct * 100)}
        <span className={`text-3xl ${isPick ? "text-brand-500" : ""}`}>%</span>
      </span>
    </div>
  );
}

// A big face-off card for a single game -- the "game of the week" slot on a
// front page. Always rendered dark so it reads the same on light and dark
// pages, and so it can sit inside the dark hero.
export default function FeaturedMatchup({
  prediction,
  sport,
  label,
  sportLabel,
  className = "",
}: {
  prediction: Prediction;
  sport: string;
  label: string;
  sportLabel?: string;
  className?: string;
}) {
  const p = prediction;
  const conf = pickConfidence(p);
  const market = marketConfidence(p);
  const homeIsPick = p.predicted_winner === p.home_team;
  const awayPct = homeIsPick ? 1 - conf : conf;

  return (
    <Link
      href={`/games/${p.game_id}?sport=${sport}`}
      className={`group relative flex flex-col overflow-hidden rounded-md bg-ink-900 text-white ring-1 ring-white/10 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:ring-brand-500/60 ${className}`}
    >
      <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 bg-brand-600 px-4 py-1.5">
        <span className="eyebrow text-[11px] text-white">{label}</span>
        <span className="text-[11px] font-semibold tracking-wide text-white/80 uppercase">
          {sportLabel && <>{sportLabel} · </>}
          {formatGameDate(p.game_date)}
        </span>
      </div>

      <div className="relative flex flex-1 items-center gap-4 px-5 py-6">
        <Side team={p.away_team} pct={awayPct} isPick={!homeIsPick} sport={sport} align="left" />
        <span className="display shrink-0 text-2xl text-neutral-600">@</span>
        <Side team={p.home_team} pct={1 - awayPct} isPick={homeIsPick} sport={sport} align="right" />
      </div>

      {/* Split bar: away share from the left, home share from the right. */}
      <div className="relative mx-5 flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={homeIsPick ? "bg-neutral-600" : "bg-brand-500"} style={{ width: `${awayPct * 100}%` }} />
        <div className={homeIsPick ? "bg-brand-500" : "bg-neutral-600"} style={{ width: `${(1 - awayPct) * 100}%` }} />
      </div>

      <div className="relative mt-4 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 text-center">
        {[
          { label: "Pick", value: p.predicted_winner },
          { label: "Margin", value: formatMargin(p.predicted_margin) },
          { label: "Market", value: market !== null ? formatPercent(market) : "—" },
        ].map((s) => (
          <div key={s.label} className="min-w-0 px-2 py-3">
            <div className="eyebrow text-[10px] text-neutral-500">{s.label}</div>
            <div className="mt-0.5 truncate text-sm font-bold">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="eyebrow relative bg-white/5 py-2 text-center text-xs text-brand-400 group-hover:text-brand-300">
        Why the model likes {p.predicted_winner} ›
      </div>
    </Link>
  );
}
