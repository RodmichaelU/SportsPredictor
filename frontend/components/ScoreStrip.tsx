import Link from "next/link";
import { Prediction } from "@/lib/types";
import { pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";

export interface ScoreStripGroup {
  sport: string;
  label: string;
  predictions: Prediction[];
}

// Seconds each tile spends crossing the screen -- slow enough to read a
// matchup in passing, so the loop's total duration scales with tile count.
const SECONDS_PER_TILE = 4;

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function Tiles({ groups, duplicate = false }: { groups: ScoreStripGroup[]; duplicate?: boolean }) {
  // The duplicate copy exists only to make the loop seamless: hidden from
  // screen readers and skipped by Tab so every game is announced once.
  const a11y = duplicate ? { tabIndex: -1 } : {};
  return (
    <div className={`flex shrink-0 ${duplicate ? "ticker-dup" : ""}`} aria-hidden={duplicate || undefined}>
      {groups.map((group) => (
        <div key={group.sport} className="flex shrink-0">
          <Link
            href={`/predictions?sport=${group.sport}`}
            {...a11y}
            className="eyebrow flex w-14 shrink-0 items-center justify-center text-[11px] text-brand-400 hover:text-white"
          >
            {group.label}
          </Link>
          {group.predictions.map((p) => {
            const conf = pickConfidence(p);
            return (
              <Link
                key={p.game_id}
                href={`/games/${p.game_id}?sport=${group.sport}`}
                {...a11y}
                className="flex w-44 shrink-0 flex-col gap-1 border-l border-white/5 px-3 py-2 transition-colors hover:bg-white/5"
              >
                <span className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">{shortTime(p.game_date)}</span>
                {[p.away_team, p.home_team].map((t) => {
                  const isPick = t === p.predicted_winner;
                  return (
                    <span key={t} className="flex items-center gap-1.5">
                      <TeamBadge team={t} sport={group.sport} size="sm" />
                      <span className={`flex-1 truncate text-xs ${isPick ? "font-bold text-white" : "text-neutral-400"}`}>{t}</span>
                      <span className={`text-xs font-bold tabular-nums ${isPick ? "text-white" : "text-neutral-600"}`}>
                        {Math.round((isPick ? conf : 1 - conf) * 100)}
                      </span>
                    </span>
                  );
                })}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// The thin, full-bleed scores bar under the header: every upcoming game as
// a compact tile, grouped by league, with the model's pick % where a live
// score would sit. Scrolls on its own as a continuous loop (pure CSS, see
// .ticker in globals.css), pausing on hover; with reduced motion it falls
// back to a plain swipeable strip.
export default function ScoreStrip({ groups }: { groups: ScoreStripGroup[] }) {
  const visible = groups.filter((g) => g.predictions.length > 0);
  if (visible.length === 0) return null;

  const tileCount = visible.reduce((n, g) => n + g.predictions.length, 0);

  return (
    <div className="ticker no-scrollbar bleed -mt-8 overflow-hidden border-b border-white/5 bg-ink-900 px-0!">
      <div className="ticker-track flex w-max" style={{ animationDuration: `${tileCount * SECONDS_PER_TILE}s` }}>
        <Tiles groups={visible} />
        <Tiles groups={visible} duplicate />
      </div>
    </div>
  );
}
