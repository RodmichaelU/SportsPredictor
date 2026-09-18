import Link from "next/link";
import { getSports, getTeams } from "@/lib/api";
import ComingSoon from "@/components/ComingSoon";
import Reveal from "@/components/Reveal";

export default async function TeamsIndexPage(props: PageProps<"/teams">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const teams = await getTeams(sport);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Teams</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Every {sportInfo?.name ?? sport} team with a prediction on record this season -- record, Elo
          trend, and full schedule.
        </p>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-neutral-500">No teams on record for this sport yet.</p>
      ) : (
        <Reveal className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
          {teams.map((team) => (
            <Link
              key={team}
              href={`/teams/${encodeURIComponent(team)}?sport=${sport}`}
              className="truncate rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-indigo-600 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-indigo-400"
            >
              {team}
            </Link>
          ))}
        </Reveal>
      )}
    </div>
  );
}
