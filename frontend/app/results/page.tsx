import { getAccuracy, getCalibration, getResults, getSports } from "@/lib/api";
import AccuracyCard from "@/components/AccuracyCard";
import CalibrationChart from "@/components/CalibrationChart";
import ResultCard from "@/components/ResultCard";
import ComingSoon from "@/components/ComingSoon";
import WeekFilter from "@/components/WeekFilter";
import Reveal from "@/components/Reveal";

export default async function ResultsPage(props: PageProps<"/results">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const [results, accuracy, calibration] = await Promise.all([
    getResults(sport),
    getAccuracy(sport),
    getCalibration(sport),
  ]);

  const weeks = [...new Set(results.map((r) => r.week))].sort((a, b) => b - a);
  const selectedWeek = searchParams.week ? Number(searchParams.week) : null;
  const visibleResults = selectedWeek ? results.filter((r) => r.week === selectedWeek) : results;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Results</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Predicted vs. actual, scored against the prediction frozen before kickoff.
          </p>
        </div>
        <WeekFilter weeks={weeks} />
      </div>

      <AccuracyCard summary={accuracy} />

      {calibration.sample_size >= 10 && (
        <Reveal className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-1 text-sm font-semibold">Is the model&apos;s confidence trustworthy?</div>
          <p className="mb-3 max-w-2xl text-sm text-neutral-500">
            Every completed game grouped by how confident the model was, compared to how often the
            home team actually won in that group. Dots on the dashed line mean the model&apos;s stated
            confidence matches reality -- e.g. games it called &quot;80% likely&quot; really won about
            80% of the time. Dot size shows how many games are in that group.
          </p>
          <CalibrationChart bins={calibration.bins} />
        </Reveal>
      )}

      {visibleResults.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {results.length === 0 ? "No completed games for this sport yet." : "No completed games for that week."}
        </p>
      ) : (
        <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleResults.map((r) => (
            <ResultCard key={r.game_id} result={r} sport={sport} />
          ))}
        </Reveal>
      )}
    </div>
  );
}
