import Link from "next/link";
import { Prediction } from "@/lib/types";
import { pickConfidence } from "@/lib/format";
import TeamBadge from "./TeamBadge";

export interface ScoreStripGroup {
  sport: string;
  label: string;
  predictions: Prediction[];
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

// The thin, full-bleed scores bar under the header on a sports front page:
// every upcoming game as a compact tile, grouped by league, with the
// model's pick % where a live score would sit.
export default function ScoreStrip({ groups }: { groups: ScoreStripGroup[] }) {
  const visible = groups.filter((g) => g.predictions.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="bleed -mt-8 border-b border-white/5 bg-ink-900">
      <div className="no-scrollbar flex overflow-x-auto">
        {visible.map((group) => (
          <div key={group.sport} className="flex shrink-0">
            <Link
              href={`/predictions?sport=${group.sport}`}
              className="eyebrow flex w-16 shrink-0 items-center justify-center border-r border-white/5 bg-ink-800 text-center text-[11px] leading-tight text-white hover:text-brand-400"
            >
              {group.label}
            </Link>
            {group.predictions.map((p) => {
              const conf = pickConfidence(p);
              return (
                <Link
                  key={p.game_id}
                  href={`/games/${p.game_id}?sport=${group.sport}`}
                  className="flex w-44 shrink-0 flex-col gap-1 border-r border-white/5 px-3 py-2 transition-colors hover:bg-white/5"
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
    </div>
  );
}
