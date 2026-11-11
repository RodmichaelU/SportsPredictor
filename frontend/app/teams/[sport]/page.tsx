import Link from "next/link";
import { getSports, getTeamSlugs } from "@/lib/api";
import { teamPath } from "@/lib/routes";
import ComingSoon from "@/components/ComingSoon";
import PageBand from "@/components/PageBand";
import TeamBadge from "@/components/TeamBadge";
import Reveal from "@/components/Reveal";

// Pre-built once per league (static export): /teams/cfb/, /teams/nfl/, ...
export async function generateStaticParams() {
  return (await getSports()).map((s) => ({ sport: s.id }));
}
export const dynamicParams = false;

export default async function TeamsIndexPage(props: PageProps<"/teams/[sport]">) {
  const { sport } = await props.params;
  const sports = await getSports();
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const slugs = await getTeamSlugs(sport);
  const teams = Object.keys(slugs).sort();

  return (
    <div className="flex flex-col gap-10">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="Teams"
        description={
          <>
          Every {sportInfo?.name ?? sport} team with a prediction on record this season -- record, Elo
          trend, and full schedule.
          </>
        }
      />

      {teams.length === 0 ? (
        <p className="text-sm text-neutral-500">No teams on record for this sport yet.</p>
      ) : (
        <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {teams.map((team) => (
            <Link
              key={team}
              href={teamPath(sport, slugs[team])}
              className="group flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 shadow-sm transition-[box-shadow,transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md active:scale-[0.98] dark:border-white/10 dark:bg-ink-900"
            >
              <TeamBadge team={team} sport={sport} size="md" />
              <span className="min-w-0 truncate text-sm font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {team}
              </span>
            </Link>
          ))}
        </Reveal>
      )}
    </div>
  );
}
