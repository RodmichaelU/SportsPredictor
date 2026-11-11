import Link from "next/link";
import { ParlayTier, ParlayTierKey } from "@/lib/types";
import { formatPercent } from "@/lib/format";
import TeamBadge from "./TeamBadge";

const STAKE = 10;

const TIER_STYLE: Record<ParlayTierKey, { level: number; accent: string; bar: string; blurb: string }> = {
  low: {
    level: 1,
    accent: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    blurb: "The model's surest picks that still beat the market's price. Small payout, best odds of cashing.",
  },
  medium: {
    level: 2,
    accent: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    blurb: "Solid favorites mixed with spots the market is underrating. A real payout without going long.",
  },
  high: {
    level: 3,
    accent: "text-brand-600 dark:text-brand-400",
    bar: "bg-brand-600",
    blurb: "Reaches for underpriced underdogs the model rates far better than the market does. Rarely hits, pays big.",
  },
};

// Marks a not-yet-frozen preview line (see ParlayLeg.early).
export function EarlyTag() {
  return (
    <span
      title="Early line: predicted from today's data, not frozen yet. Injury news can still change it."
      className="eyebrow shrink-0 rounded-sm bg-sky-500/15 px-1.5 py-px text-[9px] text-sky-600 dark:text-sky-400"
    >
      Early
    </span>
  );
}

function formatAmerican(odds: number): string {
  return odds > 0 ? `+${odds.toLocaleString()}` : odds.toLocaleString();
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

// One risk tier: the payout up front, the two hit chances (ours vs. the
// market's) side by side, then the legs.
export default function ParlayTierCard({ tier }: { tier: ParlayTier }) {
  const style = TIER_STYLE[tier.tier];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 dark:bg-ink-900 ${
        tier.tier === "high" ? "ring-brand-600/40 dark:ring-brand-500/40" : "ring-neutral-200/70 dark:ring-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 className={`display text-2xl ${style.accent}`}>{tier.label}</h2>
        {/* Risk meter: one to three filled bars. */}
        <span className="flex items-end gap-1" aria-label={`Risk level ${style.level} of 3`}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`w-1.5 rounded-sm ${n <= style.level ? style.bar : "bg-neutral-200 dark:bg-white/10"}`}
              style={{ height: `${6 + n * 4}px` }}
            />
          ))}
        </span>
      </div>
      <p className="px-5 pt-1 text-xs leading-relaxed text-neutral-500">{style.blurb}</p>
      {tier.available && !tier.value && (
        <div className="mx-5 mt-3 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-white/5 dark:text-neutral-400">
          <span className="eyebrow mr-1.5 rounded-sm bg-neutral-900 px-1.5 py-px text-[10px] text-white dark:bg-white/15">
            Best available
          </span>
          {tier.note}
        </div>
      )}

      {!tier.available ? (
        <p className="m-5 rounded-md bg-neutral-50 p-4 text-sm text-neutral-500 dark:bg-white/5">{tier.reason}</p>
      ) : (
        <>
          <div className="px-5 pt-5">
            <div className="display text-6xl tabular-nums">{formatAmerican(tier.american_odds!)}</div>
            <div className="mt-1 text-sm text-neutral-500">
              ${STAKE} pays{" "}
              <span className="font-semibold text-neutral-900 dark:text-white">
                ${(STAKE * tier.decimal_odds!).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
              </span>{" "}
              · {tier.legs.length} legs
            </div>
          </div>

          <div className="mx-5 mt-5 grid grid-cols-2 divide-x divide-neutral-100 rounded-md bg-neutral-50 py-3 text-center dark:divide-white/5 dark:bg-white/5">
            <div>
              <div className={`display text-3xl tabular-nums ${style.accent}`}>{formatPercent(tier.hit_probability!)}</div>
              <div className="eyebrow text-[10px] text-neutral-500">Model: hits</div>
            </div>
            <div>
              <div className="display text-3xl text-neutral-400 tabular-nums">{formatPercent(tier.market_hit_probability!)}</div>
              <div className="eyebrow text-[10px] text-neutral-500">Market: hits</div>
            </div>
          </div>

          <ul className="mt-4 flex-1 px-5">
            {tier.legs.map((leg) => (
              <li key={`${leg.sport}-${leg.game_id}`} className="border-t border-neutral-100 first:border-0 dark:border-white/5">
                <Link href={`/games/${leg.game_id}?sport=${leg.sport}`} className="group flex items-center gap-3 py-3">
                  <TeamBadge team={leg.team} sport={leg.sport} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {leg.team}
                      </span>
                      {leg.early && <EarlyTag />}
                    </div>
                    <div className="truncate text-xs text-neutral-500">
                      {leg.is_home ? "vs" : "@"} {leg.opponent} · {leg.sport.toUpperCase()} · {shortDate(leg.game_date)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums">{formatAmerican(leg.american_odds)}</div>
                    <div className="text-[11px] text-neutral-500 tabular-nums">
                      {formatPercent(leg.model_probability)} vs {formatPercent(leg.market_probability)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-auto border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500 dark:border-white/5">
            If the model is right, this returns{" "}
            <span
              className={`font-semibold ${
                tier.expected_return! >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-brand-600 dark:text-brand-400"
              }`}
            >
              {tier.expected_return! >= 0 ? "+" : ""}
              {Math.round(tier.expected_return! * 100)}%
            </span>{" "}
            per dollar on average.
          </div>
        </>
      )}
    </div>
  );
}
