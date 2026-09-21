import Link from "next/link";
import { StandingsGroup } from "@/lib/types";
import TeamBadge from "./TeamBadge";

export default function StandingsTable({ group, sport }: { group: StandingsGroup; sport: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 text-sm font-semibold">{group.group}</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-400">
            <th className="pb-2 font-medium">Team</th>
            <th className="w-10 pb-2 text-right font-medium">W</th>
            <th className="w-10 pb-2 text-right font-medium">L</th>
            <th className="w-14 pb-2 text-right font-medium">Pct</th>
          </tr>
        </thead>
        <tbody>
          {group.teams.map((t, i) => {
            const games = t.wins + t.losses;
            const pct = games > 0 ? t.wins / games : 0;
            return (
              <tr key={t.team} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-1.5">
                  <Link
                    href={`/teams/${encodeURIComponent(t.team)}?sport=${sport}`}
                    className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <span className="w-4 shrink-0 text-xs text-neutral-400 tabular-nums">{i + 1}</span>
                    <TeamBadge team={t.team} sport={sport} size="sm" />
                    <span className="truncate">{t.team}</span>
                  </Link>
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{t.wins}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-500">{t.losses}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-500">{pct.toFixed(3).replace(/^0/, "")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
