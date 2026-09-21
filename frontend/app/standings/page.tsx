import { getSports, getStandings } from "@/lib/api";
import ComingSoon from "@/components/ComingSoon";
import Reveal from "@/components/Reveal";
import StandingsTable from "@/components/StandingsTable";

export default async function StandingsPage(props: PageProps<"/standings">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const standings = await getStandings(sport);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Standings</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          {sportInfo?.name ?? sport} win-loss records this season, grouped by{" "}
          {sport === "nfl" ? "division" : "conference"}. Computed from the same completed games every
          result and team page on this site uses.
        </p>
      </div>

      {standings.groups.length === 0 ? (
        <p className="text-sm text-neutral-500">No standings on record for this sport yet.</p>
      ) : (
        <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {standings.groups.map((group) => (
            <StandingsTable key={group.group} group={group} sport={sport} />
          ))}
        </Reveal>
      )}
    </div>
  );
}
