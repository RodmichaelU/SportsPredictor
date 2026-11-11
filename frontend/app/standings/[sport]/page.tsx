import { getSports, getStandings, getTeamSlugs } from "@/lib/api";
import ComingSoon from "@/components/ComingSoon";
import PageBand from "@/components/PageBand";
import Reveal from "@/components/Reveal";
import StandingsTable from "@/components/StandingsTable";

// Pre-built once per league (static export): /standings/cfb/, /standings/nfl/, ...
export async function generateStaticParams() {
  return (await getSports()).map((s) => ({ sport: s.id }));
}
export const dynamicParams = false;

export default async function StandingsPage(props: PageProps<"/standings/[sport]">) {
  const { sport } = await props.params;
  const sports = await getSports();
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const [standings, slugs] = await Promise.all([getStandings(sport), getTeamSlugs(sport)]);

  return (
    <div className="flex flex-col gap-10">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="Standings"
        description={
          <>
          {sportInfo?.name ?? sport} win-loss records this season, grouped by{" "}
          {sport === "nfl" ? "division" : "conference"}. Computed from the same completed games every
          result and team page on this site uses.
          </>
        }
      />

      {standings.groups.length === 0 ? (
        <p className="text-sm text-neutral-500">No standings on record for this sport yet.</p>
      ) : (
        <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {standings.groups.map((group) => (
            <StandingsTable key={group.group} group={group} sport={sport} slugs={slugs} />
          ))}
        </Reveal>
      )}
    </div>
  );
}
