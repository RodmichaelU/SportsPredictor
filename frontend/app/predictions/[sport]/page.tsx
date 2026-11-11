import Link from "next/link";
import { getMeta, getPredictions, getSports } from "@/lib/api";
import { modelPath } from "@/lib/routes";
import UpdatedAt from "@/components/UpdatedAt";
import { Prediction } from "@/lib/types";
import { pickConfidence } from "@/lib/format";
import PredictionCard from "@/components/PredictionCard";
import ComingSoon from "@/components/ComingSoon";
import FeaturedMatchup from "@/components/FeaturedMatchup";
import MarketDisagreements from "@/components/MarketDisagreements";
import PageBand from "@/components/PageBand";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// Pre-built once per league (static export): /predictions/cfb/, /predictions/nfl/, ...
export async function generateStaticParams() {
  return (await getSports()).map((s) => ({ sport: s.id }));
}
export const dynamicParams = false;

export default async function PredictionsPage(props: PageProps<"/predictions/[sport]">) {
  const { sport } = await props.params;
  const sports = await getSports();
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const [predictions, meta] = await Promise.all([getPredictions(sport), getMeta()]);
  const strongest = [...predictions].sort((a, b) => pickConfidence(b) - pickConfidence(a))[0];

  // Chronological, grouped by game day.
  const days: { day: string; games: Prediction[] }[] = [];
  for (const p of [...predictions].sort((a, b) => a.game_date.localeCompare(b.game_date))) {
    const day = dayKey(p.game_date);
    if (days.at(-1)?.day !== day) days.push({ day, games: [] });
    days.at(-1)!.games.push(p);
  }

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="This week's picks"
        description={
          <>
            {predictions.length} upcoming games, each frozen before kickoff. Tap any game to see why the
            model likes its pick, or{" "}
            <Link href={modelPath(sport)} className="underline decoration-white/30 underline-offset-2 hover:text-brand-400">
              how the model works
            </Link>
            .
            {meta && (
              <div className="mt-4">
                <UpdatedAt iso={meta.refreshed_at} intervalHours={meta.refresh_interval_hours} variant="pill" />
              </div>
            )}
          </>
        }
        aside={
          strongest && (
            <FeaturedMatchup prediction={strongest} sport={sport} label="Strongest pick" className="w-full lg:w-[26rem]" />
          )
        }
      />

      {predictions.length === 0 ? (
        <p className="text-sm text-neutral-500">No upcoming predictions for this sport yet.</p>
      ) : (
        <>
          <MarketDisagreements predictions={predictions} sport={sport} />

          {days.map(({ day, games }) => (
            <Reveal as="section" key={day}>
              <SectionHeader title={day} eyebrow={`${games.length} game${games.length === 1 ? "" : "s"}`} />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((p) => (
                  <PredictionCard key={p.game_id} prediction={p} sport={sport} />
                ))}
              </div>
            </Reveal>
          ))}
        </>
      )}
    </div>
  );
}
