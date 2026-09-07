import { getPredictions, getSports } from "@/lib/api";
import ConfidenceBar from "@/components/ConfidenceBar";
import { formatGameDate, formatMargin, pickConfidence } from "@/lib/format";

export default async function PredictionsPage(props: PageProps<"/predictions">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const predictions = await getPredictions(sport);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Upcoming predictions</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Predictions are frozen before kickoff and never recomputed after the result is known.
        </p>
      </div>

      {predictions.length === 0 ? (
        <p className="text-sm text-neutral-500">No upcoming predictions for this sport yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-100/60 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <th className="px-4 py-3 font-medium">Matchup</th>
                <th className="px-4 py-3 font-medium">Kickoff</th>
                <th className="px-4 py-3 font-medium">Pick</th>
                <th className="px-4 py-3 font-medium">Margin</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr
                  key={p.game_id}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
                >
                  <td className="px-4 py-3 font-medium">
                    {p.away_team} @ {p.home_team}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatGameDate(p.game_date)}</td>
                  <td className="px-4 py-3">{p.predicted_winner}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-500">
                    {formatMargin(p.predicted_margin)}
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBar confidence={pickConfidence(p)} />
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
