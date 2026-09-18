import Link from "next/link";
import { getPredictions, getSports } from "@/lib/api";
import PredictionCard from "@/components/PredictionCard";
import ComingSoon from "@/components/ComingSoon";
import MarketDisagreements from "@/components/MarketDisagreements";
import Reveal from "@/components/Reveal";

export default async function PredictionsPage(props: PageProps<"/predictions">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const predictions = await getPredictions(sport);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Upcoming predictions</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Predictions are frozen before kickoff and never recomputed after the result is known.{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Model</span> is our own
          prediction, trained on each team&apos;s historical stats (
          <Link
            href={`/model?sport=${sport}`}
            className="underline decoration-neutral-300 underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            see how
          </Link>
          ).{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Market</span> is the live
          price from Kalshi, a real-money prediction market -- real people trading real dollars on the
          outcome, not another model.
        </p>
      </div>

      {predictions.length === 0 ? (
        <p className="text-sm text-neutral-500">No upcoming predictions for this sport yet.</p>
      ) : (
        <>
          <MarketDisagreements predictions={predictions} sport={sport} />
          <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {predictions.map((p) => (
              <PredictionCard key={p.game_id} prediction={p} sport={sport} />
            ))}
          </Reveal>
        </>
      )}
    </div>
  );
}
