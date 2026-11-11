import Link from "next/link";
import { Result } from "@/lib/types";
import { rankByUpset } from "@/lib/upsets";
import { formatPercent } from "@/lib/format";
import SectionHeader, { Panel } from "./SectionHeader";
import TeamBadge from "./TeamBadge";
import { gamePath } from "@/lib/routes";

// The flip side of MarketDisagreements: not "where might we be wrong", but
// "where we already were", ranked by how confident the model was in the
// pick that lost. A 51% pick losing is a coin flip going the other way; a
// 90%+ pick losing is the model getting caught flat-footed. Laid out as a
// compact list beside the results page's weekly chart.
export default function BiggestUpsets({ results, sport }: { results: Result[]; sport: string }) {
  const upsets = rankByUpset(results).slice(0, 4);
  if (upsets.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Biggest upsets" />
      <Panel className="py-1">
        <p className="border-b border-neutral-100 py-2.5 text-[11px] text-neutral-500 dark:border-white/5">
          Completed games the model was most confident about -- and got wrong.
        </p>
        {upsets.map(({ result: r, confidence }) => (
          <Link
            key={r.game_id}
            href={gamePath(sport, r.game_id)}
            className="group flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0 dark:border-white/5"
          >
            <TeamBadge team={r.actual_winner} sport={sport} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {r.actual_winner}{" "}
                <span className="tabular-nums">
                  {Math.max(r.home_score, r.away_score)}–{Math.min(r.home_score, r.away_score)}
                </span>
              </div>
              <div className="truncate text-xs text-neutral-500">
                Over {r.predicted_winner}, won by {Math.round(Math.abs(r.actual_margin))}
              </div>
            </div>
            <span className="display shrink-0 text-xl text-brand-600 tabular-nums dark:text-brand-400">
              {formatPercent(confidence)}
            </span>
          </Link>
        ))}
      </Panel>
    </div>
  );
}
