import type { Metadata } from "next";
import Link from "next/link";
import { getSports, getTeam } from "@/lib/api";
import { Result, TeamGame } from "@/lib/types";
import { pickConfidence } from "@/lib/format";
import ComingSoon from "@/components/ComingSoon";
import EloTrendChart from "@/components/EloTrendChart";
import PredictionCard from "@/components/PredictionCard";
import HitBadge from "@/components/HitBadge";
import { BandStat } from "@/components/PageBand";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import TeamBadge from "@/components/TeamBadge";
import Reveal from "@/components/Reveal";

function isDecided(g: TeamGame): g is TeamGame & Result {
  return g.hit !== null;
}

// Reuses the same getTeam call the page below makes -- Next memoizes
// fetches with identical args across generateMetadata and the page
// component in one request, so this doesn't cost a second round-trip.
export async function generateMetadata(props: PageProps<"/teams/[team]">): Promise<Metadata> {
  const { team: encodedTeam } = await props.params;
  const searchParams = await props.searchParams;
  const team = decodeURIComponent(encodedTeam);
  const sport = (searchParams.sport as string) ?? "cfb";

  try {
    const data = await getTeam(sport, team);
    const elo = data.current_elo !== null ? ` · Elo ${Math.round(data.current_elo)}` : "";
    return {
      title: data.team,
      description: `${data.team} is ${data.record.wins}-${data.record.losses} this season${elo}.`,
    };
  } catch {
    return { title: team };
  }
}

export default async function TeamPage(props: PageProps<"/teams/[team]">) {
  const { team: encodedTeam } = await props.params;
  const searchParams = await props.searchParams;
  const team = decodeURIComponent(encodedTeam);

  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const data = await getTeam(sport, team);
  const upcoming = data.games.filter((g) => !isDecided(g));
  const decided = data.games.filter(isDecided).slice().reverse();

  const hits = decided.filter((g) => g.hit).length;
  const eloStart = data.elo_history[0]?.rating_before ?? null;
  const eloDelta = eloStart !== null && data.current_elo !== null ? data.current_elo - eloStart : null;

  return (
    <div className="flex flex-col gap-14">
      <section className="bleed relative -mt-8 overflow-hidden bg-ink-950 text-white">
        <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="bleed-inner relative py-8">
          <Link href={`/teams?sport=${sport}`} className="eyebrow text-xs text-neutral-400 hover:text-white">
            ‹ All teams
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
            <div className="flex min-w-0 items-center gap-5">
              <TeamBadge team={data.team} sport={sport} size="xl" />
              <div className="min-w-0">
                <div className="eyebrow text-brand-400">{sportInfo?.name ?? sport.toUpperCase()}</div>
                <h1 className="display text-5xl break-words sm:text-7xl">{data.team}</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <BandStat value={`${data.record.wins}-${data.record.losses}`} label="Record" />
              {data.current_elo !== null && (
                <BandStat
                  value={
                    <>
                      {Math.round(data.current_elo)}
                      {eloDelta !== null && (
                        <span className={`ml-2 text-2xl ${eloDelta >= 0 ? "text-emerald-400" : "text-brand-500"}`}>
                          {eloDelta >= 0 ? "▲" : "▼"}
                          {Math.abs(Math.round(eloDelta))}
                        </span>
                      )}
                    </>
                  }
                  label="Elo rating"
                />
              )}
              {decided.length > 0 && (
                <BandStat value={`${hits}/${decided.length}`} label="Model on their games" accent />
              )}
            </div>
          </div>
        </div>
      </section>

      {upcoming.length > 0 && (
        <Reveal as="section">
          <SectionHeader title="Up next" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.slice(0, 3).map((g) => (
              <PredictionCard key={g.game_id} prediction={g} sport={sport} />
            ))}
          </div>
        </Reveal>
      )}

      <Reveal as="section">
        <SectionHeader title="Elo rating this season" />
        <Panel className="p-6">
          <EloTrendChart history={data.elo_history} currentRating={data.current_elo} />
        </Panel>
      </Reveal>

      {decided.length > 0 && (
        <Reveal>
          <SectionHeader eyebrow={`${data.record.wins}-${data.record.losses}`} title="Season so far" />
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-white/10">
                  {["Date", "Opponent", "Result", "Model pick", ""].map((h, i) => (
                    <th key={i} className="eyebrow px-4 py-2 text-[11px] font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decided.map((g) => {
                  const isHome = g.home_team === data.team;
                  const opponent = isHome ? g.away_team : g.home_team;
                  const won = g.actual_winner === data.team;
                  const teamScore = isHome ? g.home_score : g.away_score;
                  const oppScore = isHome ? g.away_score : g.home_score;
                  return (
                    <tr key={g.game_id} className="border-t border-neutral-100 even:bg-neutral-50/60 dark:border-white/5 dark:even:bg-white/[0.02]">
                      <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">
                        {new Date(g.game_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/teams/${encodeURIComponent(opponent)}?sport=${sport}`}
                          className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          <span className="w-4 text-xs text-neutral-400">{isHome ? "vs" : "@"}</span>
                          <TeamBadge team={opponent} sport={sport} size="sm" />
                          <span className="truncate font-medium">{opponent}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                        <span className={`mr-2 font-bold ${won ? "text-emerald-600 dark:text-emerald-400" : "text-brand-600 dark:text-brand-400"}`}>
                          {won ? "W" : "L"}
                        </span>
                        {teamScore}-{oppScore}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                        {g.predicted_winner} ({Math.round(pickConfidence(g) * 100)}%)
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/games/${g.game_id}?sport=${sport}`} className="inline-flex items-center gap-2">
                          <HitBadge hit={g.hit} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </Reveal>
      )}
    </div>
  );
}
