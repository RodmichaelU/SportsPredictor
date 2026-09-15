import { getAccuracy, getResults, getSports } from "@/lib/api";
import AccuracyCard from "@/components/AccuracyCard";
import ResultCard from "@/components/ResultCard";

export default async function ResultsPage(props: PageProps<"/results">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const [results, accuracy] = await Promise.all([getResults(sport), getAccuracy(sport)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Results</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Predicted vs. actual, scored against the prediction frozen before kickoff.
        </p>
      </div>

      <AccuracyCard summary={accuracy} />

      {results.length === 0 ? (
        <p className="text-sm text-neutral-500">No completed games for this sport yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <ResultCard key={r.game_id} result={r} sport={sport} />
          ))}
        </div>
      )}
    </div>
  );
}
