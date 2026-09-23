import type { Metadata } from "next";
import Link from "next/link";
import { getSports, getTeam } from "@/lib/api";
import { Result, TeamGame } from "@/lib/types";
import ComingSoon from "@/components/ComingSoon";
import EloTrendChart from "@/components/EloTrendChart";
import PredictionCard from "@/components/PredictionCard";
import ResultCard from "@/components/ResultCard";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/teams?sport=${sport}`} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          ← All teams
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <TeamBadge team={data.team} sport={sport} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold">{data.team}</h1>
            <p className="text-sm text-neutral-500">
              {data.record.wins}-{data.record.losses} this season
              {data.current_elo !== null && <> · Elo {Math.round(data.current_elo)}</>}
            </p>
          </div>
        </div>
      </div>

      <Reveal className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 text-sm font-semibold">Elo rating this season</div>
        <EloTrendChart history={data.elo_history} currentRating={data.current_elo} />
      </Reveal>

      {upcoming.length > 0 && (
        <Reveal delayMs={100}>
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((g) => (
              <PredictionCard key={g.game_id} prediction={g} sport={sport} />
            ))}
          </div>
        </Reveal>
      )}

      {decided.length > 0 && (
        <Reveal delayMs={upcoming.length > 0 ? 200 : 100}>
          <h2 className="text-lg font-semibold">Season so far</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decided.map((g) => (
              <ResultCard key={g.game_id} result={g} sport={sport} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
