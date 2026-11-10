import Link from "next/link";
import { StandingsGroup } from "@/lib/types";
import TeamBadge from "./TeamBadge";

export default function StandingsTable({ group, sport }: { group: StandingsGroup; sport: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-ink-900">
      <div className="display bg-ink-950 px-4 py-2.5 text-xl text-white shadow-[inset_4px_0_0_0_var(--color-brand-600)]">{group.group}</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="eyebrow bg-neutral-50 text-left text-[11px] text-neutral-500 dark:bg-white/[0.03]">
            <th className="px-4 py-2 font-bold">Team</th>
            <th className="w-10 py-2 text-right font-bold">W</th>
            <th className="w-10 py-2 text-right font-bold">L</th>
            <th className="w-16 py-2 pr-4 text-right font-bold">Pct</th>
          </tr>
        </thead>
        <tbody>
          {group.teams.map((t, i) => {
            const games = t.wins + t.losses;
            const pct = games > 0 ? t.wins / games : 0;
            return (
              <tr key={t.team} className="border-t border-neutral-100 even:bg-neutral-50/60 dark:border-white/5 dark:even:bg-white/[0.02]">
                <td className={`py-2 pl-4 ${i === 0 ? "shadow-[inset_3px_0_0_0_var(--color-brand-600)]" : ""}`}>
                  <Link
                    href={`/teams/${encodeURIComponent(t.team)}?sport=${sport}`}
                    className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    <span className="w-4 shrink-0 text-xs text-neutral-400 tabular-nums">{i + 1}</span>
                    <TeamBadge team={t.team} sport={sport} size="sm" />
                    <span className="truncate">{t.team}</span>
                  </Link>
                </td>
                <td className="py-2 text-right font-bold tabular-nums">{t.wins}</td>
                <td className="py-2 text-right tabular-nums text-neutral-500">{t.losses}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-neutral-500">{pct.toFixed(3).replace(/^0/, "")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
