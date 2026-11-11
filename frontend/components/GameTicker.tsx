import Link from "next/link";
import { ValueBet } from "@/lib/valueBets";
import TeamBadge from "./TeamBadge";
import { gamePath } from "@/lib/routes";

// A compact horizontal-scroll strip of this week's best value bets -- the
// games where our model and the live market disagree most, weighted by
// expected return rather than raw probability gap (see lib/valueBets.ts).
// Styled as a scoreboard bar: dark tiles on the dark hero, model % where
// the score would be.
export default function GameTicker({ picks, sport }: { picks: ValueBet[]; sport: string }) {
  if (picks.length === 0) return null;

  return (
    // The browser's own horizontal scrollbar track read as a stray line
    // cutting across the hero section -- hidden via .no-scrollbar, but the
    // strip still scrolls fine with touch/trackpad/drag.
    <div className="no-scrollbar w-full snap-x snap-mandatory overflow-x-auto">
      <div className="mx-auto flex w-max gap-px px-6 pb-2">
        {picks.map(({ prediction: p, team, modelProb, marketProb, roi }) => (
          <Link
            key={p.game_id}
            href={gamePath(sport, p.game_id)}
            className="flex w-52 shrink-0 snap-start flex-col gap-2 border-t-2 border-transparent bg-ink-800 p-3 transition-colors duration-150 first:rounded-l-sm last:rounded-r-sm hover:border-brand-500 hover:bg-[#252932]"
          >
            {[p.away_team, p.home_team].map((t) => (
              <div key={t} className="flex items-center gap-2">
                <TeamBadge team={t} sport={sport} size="sm" />
                <span className={`flex-1 truncate text-xs ${t === team ? "font-bold text-white" : "text-neutral-400"}`}>
                  {t}
                </span>
                {t === team && (
                  <span className="display text-xl text-white tabular-nums">{Math.round(modelProb * 100)}%</span>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
              <span className="text-neutral-400">Mkt {Math.round(marketProb * 100)}%</span>
              <span className="eyebrow rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                +{Math.round(roi * 100)}% value
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
