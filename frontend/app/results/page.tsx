import { getAccuracy, getResults, getSports } from "@/lib/api";
import AccuracyCard from "@/components/AccuracyCard";
import HitBadge from "@/components/HitBadge";
import { formatGameDate, formatMargin, pickConfidence } from "@/lib/format";

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
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-100/60 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <th className="px-4 py-3 font-medium">Matchup</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Pick</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Final</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.game_id}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
                >
                  <td className="px-4 py-3 font-medium">
                    {r.away_team} @ {r.home_team}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatGameDate(r.game_date)}</td>
                  <td className="px-4 py-3">
                    {r.predicted_winner} {formatMargin(r.predicted_margin)}
                  </td>
                  <td className="px-4 py-3">{Math.round(pickConfidence(r) * 100)}%</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-500">
                    {r.away_team} {r.away_score} - {r.home_score} {r.home_team}
                  </td>
                  <td className="px-4 py-3">
                    <HitBadge hit={r.hit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
