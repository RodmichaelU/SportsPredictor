import { getModelWeights, getSports } from "@/lib/api";
import WeightBar from "@/components/WeightBar";
import ModelCurveExplorer from "@/components/ModelCurveExplorer";

export default async function ModelPage(props: PageProps<"/model">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const data = await getModelWeights(sport);

  const maxAbsWeight = Math.max(...data.weights.map((w) => Math.abs(w.weight)), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">What&apos;s driving the model</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Standardized coefficients from the win-probability model (logistic regression), trained on{" "}
          {data.trained_on_games.toLocaleString()} games. Every feature is scaled the same way before
          the model sees it, so bar length is directly comparable across features regardless of each
          one&apos;s raw units.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-600" />A higher value for this gap increases
          the predicted home win probability
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-600" />A higher value decreases it
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        {data.weights.map((w) => (
          <WeightBar key={w.feature} weight={w} maxAbsWeight={maxAbsWeight} />
        ))}
      </div>

      <p className="text-xs text-neutral-500">
        Model version {data.model_version}. All &quot;gap&quot; features are home team minus away
        team -- e.g. a positive Elo rating gap means the home team is rated higher.
      </p>

      <div className="mt-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">See the actual math</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Win probability comes from logistic regression (an S-curve, saturating toward 0% and 100%
          rather than going linear); margin comes from ridge regression (a straight line). These are
          the real fitted models predict.py runs, not a simplified stand-in. Gradient boosting
          (XGBoost) was evaluated alongside these during development but isn&apos;t what generates the
          predictions shown elsewhere in this app, so there&apos;s no tree diagram here -- it would
          describe a model that isn&apos;t actually making the picks.
        </p>
        <div className="mt-4">
          <ModelCurveExplorer sport={sport} featureOptions={data.weights} />
        </div>
      </div>
    </div>
  );
}
