import { getModelWeights, getSports } from "@/lib/api";
import WeightBar from "@/components/WeightBar";
import ModelCurveExplorer from "@/components/ModelCurveExplorer";
import ComingSoon from "@/components/ComingSoon";
import PageBand from "@/components/PageBand";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";

export default async function ModelPage(props: PageProps<"/model">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const data = await getModelWeights(sport);

  const maxAbsWeight = Math.max(...data.weights.map((w) => Math.abs(w.weight)), 0);

  return (
    <div className="flex flex-col gap-10">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="What's driving the model"
        description={
          <>
          Standardized coefficients from the win-probability model (logistic regression), trained on{" "}
          {data.trained_on_games.toLocaleString()} games. Every feature is scaled the same way before
          the model sees it, so bar length is directly comparable across features regardless of each
          one&apos;s raw units.
          </>
        }
      />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
        <Reveal>
          <SectionHeader eyebrow={`${data.weights.length} features`} title="Feature weights" />
          <Panel className="flex flex-col gap-3">
            {data.weights.map((w) => (
              <WeightBar key={w.feature} weight={w} maxAbsWeight={maxAbsWeight} />
            ))}
          </Panel>
        </Reveal>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-28">
          <div>
            <SectionHeader title="Training set" size="sm" />
            <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-neutral-200 p-0 dark:bg-white/10">
              {[
                { label: "Games", value: data.trained_on_games.toLocaleString() },
                { label: "Features", value: data.weights.length },
              ].map((s) => (
                <div key={s.label} className="bg-white p-3 dark:bg-ink-900">
                  <div className="eyebrow text-[10px] text-neutral-400">{s.label}</div>
                  <div className="display mt-0.5 text-3xl tabular-nums">{s.value}</div>
                </div>
              ))}
            </Panel>
          </div>
          <div>
            <SectionHeader title="How to read it" size="sm" />
            <Panel className="flex flex-col gap-3 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-600" />A higher value for this gap
                increases the predicted home win probability
              </span>
              <span className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-600" />A higher value decreases it
              </span>
              <p className="border-t border-neutral-100 pt-3 dark:border-white/5">
                All &quot;gap&quot; features are home team minus away team -- e.g. a positive Elo rating gap
                means the home team is rated higher.
              </p>
              <p className="text-neutral-500">Model version {data.model_version}.</p>
            </Panel>
          </div>
        </aside>
      </div>

      <Reveal as="section">
        <SectionHeader eyebrow="Interactive" title="See the actual math" />
        <p className="max-w-2xl text-sm text-neutral-500">
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
      </Reveal>
    </div>
  );
}
