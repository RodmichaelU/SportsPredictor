import { getAccuracy, getCalibration, getModelWeights, getResults, getSports } from "@/lib/api";
import WeightBar from "@/components/WeightBar";
import ModelCurveExplorer from "@/components/ModelCurveExplorer";
import CalibrationChart from "@/components/CalibrationChart";
import ComingSoon from "@/components/ComingSoon";
import PageBand from "@/components/PageBand";
import RecordByConfidence from "@/components/RecordByConfidence";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";

// The full methodology walkthrough -- the home page shows a three-step
// summary and links here.
const PIPELINE = [
  {
    title: "Start with what was true before kickoff",
    body: (
      <>
        Every game gets built from things that were already known before the ball was snapped: each
        team&apos;s scoring efficiency this season, the closing betting line, recruiting rankings, rest
        days, home field. Nothing from after the game starts ever touches a prediction -- that&apos;s the
        one rule that keeps this honest. A model that peeks at the result would look brilliant and mean
        nothing.
      </>
    ),
  },
  {
    title: "A baseline: Elo ratings",
    body: (
      <>
        Think of it like a chess ranking. Every team starts at the same rating. Win, and your rating
        climbs -- more if you beat a good team, less if you beat a weak one. Lose, and it falls the same
        way. No box scores or advanced stats needed, just wins and losses against the right opponents,
        and after enough games the ratings settle into a genuinely useful read on how good a team is
        right now. We build this from scratch and treat it as the floor: anything fancier has to actually
        beat it to justify existing.
      </>
    ),
  },
  {
    title: "Win probability: logistic regression",
    body: (
      <>
        This is the model that actually picks winners. It takes a dozen-plus stats -- the Elo gap, the
        betting line, recent offense and defense, rest, recruiting talent -- and turns them into a single
        percentage. Its fitted curve is an S-shape, not a straight line: the model correctly refuses to
        ever predict below 0% or above 100%, flattening out at the extremes instead of running off to
        nonsense values. You can explore the real curve at the bottom of this page.
      </>
    ),
  },
  {
    title: "Predicted margin: ridge regression",
    body: (
      <>
        A close cousin of the win-probability model, but instead of a percentage it predicts the final
        score margin -- how many points a team should win or lose by. This one really is a straight line,
        because ridge regression is linear: for every extra point on a feature, the predicted margin
        shifts by a fixed amount the model learned from thousands of past games.
      </>
    ),
  },
  {
    title: "Why not something fancier?",
    body: (
      <>
        We also tried gradient boosting (XGBoost) -- a more powerful model built from decision trees that
        can learn complicated combinations of stats, like &quot;teams with a big Elo edge <em>and</em> extra
        rest <em>and</em> a road environment.&quot; It&apos;s a great tool when you have huge amounts of
        data. Football doesn&apos;t give you that: a team plays somewhere between 12 and 17 games a season.
        Hand a complicated model that little data and it starts memorizing noise instead of learning real
        patterns. When we actually compared them, the two simpler statistical models above matched or beat
        the tree model -- so those are what generate every pick in this app. The tree model still gets
        trained for comparison, but it never touches a live prediction.
      </>
    ),
  },
  {
    title: "Graded honestly, every week",
    body: (
      <>
        Every prediction is frozen -- saved before kickoff -- and never touched again, even once we know
        who won. After the game ends, it gets scored against what actually happened. The Results page for
        each league is that scoreboard: not the model bragging with hindsight, but every pick checked
        against the same rule any honest forecaster has to follow.
      </>
    ),
  },
];

const SECTIONS = [
  { id: "pipeline", label: "The pipeline" },
  { id: "drivers", label: "What drives it" },
  { id: "honesty", label: "Is it honest?" },
  { id: "math", label: "The math" },
];

// Pre-built once per league (static export): /model/cfb/, /model/nfl/, ...
export async function generateStaticParams() {
  return (await getSports()).map((s) => ({ sport: s.id }));
}
export const dynamicParams = false;

export default async function ModelPage(props: PageProps<"/model/[sport]">) {
  const { sport } = await props.params;
  const sports = await getSports();
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const [data, results, calibration, accuracy] = await Promise.all([
    getModelWeights(sport),
    getResults(sport),
    getCalibration(sport),
    getAccuracy(sport),
  ]);
  const metric = (v: number | null) => (v === null ? "—" : v.toFixed(3));

  const maxAbsWeight = Math.max(...data.weights.map((w) => Math.abs(w.weight)), 0);

  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="How the model works"
        description={
          <>
            From raw stats to a frozen, graded pick -- trained on {data.trained_on_games.toLocaleString()}{" "}
            games with {data.weights.length} features.
          </>
        }
      >
        <nav className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="eyebrow rounded-full bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/20">
              {s.label}
            </a>
          ))}
        </nav>
      </PageBand>

      {/* A numbered timeline: one rail, one step at a time. */}
      <section id="pipeline" className="scroll-mt-32">
        <SectionHeader title="The pipeline" />
        <div className="relative ml-5 border-l border-neutral-200 dark:border-white/10">
          {PIPELINE.map((step, i) => (
            <Reveal key={step.title} as="div" className="relative pb-12 pl-10 last:pb-0">
              <span className="display absolute -left-5 flex h-10 w-10 items-center justify-center rounded-full bg-ink-950 text-lg text-white ring-4 ring-background dark:bg-brand-600">
                {i + 1}
              </span>
              <h3 className="display pt-1.5 text-2xl sm:text-3xl">{step.title}</h3>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="scroll-mt-32">
        <div id="drivers" className="scroll-mt-32" />
        <SectionHeader title="What drives it" />
        <p className="mb-5 max-w-2xl text-sm text-neutral-500">
          Standardized coefficients from the win-probability model, so bar length is directly comparable
          across features. <span className="font-semibold text-sky-600">Blue</span> raises the home team&apos;s
          win probability as the gap grows; <span className="font-semibold text-amber-600">amber</span> lowers
          it. All &quot;gap&quot; features are home team minus away team.
        </p>
        <Panel className="flex flex-col gap-3 p-4 sm:p-6">
          {data.weights.map((w) => (
            <WeightBar key={w.feature} weight={w} maxAbsWeight={maxAbsWeight} />
          ))}
        </Panel>
        <p className="mt-3 text-xs text-neutral-500">Model version {data.model_version}.</p>
      </Reveal>

      {results.length > 0 && (
        <Reveal as="section">
          <div id="honesty" className="scroll-mt-32" />
          <SectionHeader title="Is the confidence honest?" />
          <p className="mb-5 max-w-2xl text-sm text-neutral-500">
            A forecaster that says &quot;80%&quot; should be right about 80% of the time. Two ways of checking,
            across every graded {sportInfo?.name ?? sport} pick.
          </p>
          <div className="mb-6 grid grid-cols-3 divide-x divide-neutral-200 rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/70 dark:divide-white/10 dark:bg-ink-900 dark:ring-white/10">
            {[
              { label: "Log loss", value: metric(accuracy.log_loss), hint: "lower is better" },
              { label: "Brier score", value: metric(accuracy.brier_score), hint: "lower is better" },
              { label: "Calibration error", value: metric(accuracy.ece), hint: "0 is perfect" },
            ].map((m) => (
              <div key={m.label} className="p-5 text-center">
                <div className="display text-4xl tabular-nums">{m.value}</div>
                <div className="eyebrow mt-1 text-[11px] text-neutral-500">{m.label}</div>
                <div className="text-[11px] text-neutral-400">{m.hint}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel className="p-4 sm:p-6">
              <h3 className="display mb-4 text-xl">Record by confidence</h3>
              <RecordByConfidence results={results} />
            </Panel>
            {calibration.sample_size >= 10 && (
              <Panel className="p-4 sm:p-6">
                <h3 className="display mb-1 text-xl">Calibration</h3>
                <p className="mb-3 text-xs text-neutral-500">
                  Games grouped by predicted home win probability vs. how often the home team actually won.
                  Dots on the dashed line mean stated confidence matches reality; dot size is the number of
                  games.
                </p>
                <div className="mx-auto max-w-sm">
                  <CalibrationChart bins={calibration.bins} />
                </div>
              </Panel>
            )}
          </div>
        </Reveal>
      )}

      <Reveal as="section">
        <div id="math" className="scroll-mt-32" />
        <SectionHeader title="See the actual math" />
        <p className="mb-5 max-w-2xl text-sm text-neutral-500">
          Win probability comes from logistic regression (an S-curve, saturating toward 0% and 100% rather
          than going linear); margin comes from ridge regression (a straight line). These are the real
          fitted models predict.py runs, not a simplified stand-in. Gradient boosting (XGBoost) was evaluated
          alongside these during development but isn&apos;t what generates the predictions shown elsewhere in
          this app, so there&apos;s no tree diagram here -- it would describe a model that isn&apos;t actually
          making the picks.
        </p>
        <ModelCurveExplorer sport={sport} featureOptions={data.weights} />
      </Reveal>
    </div>
  );
}
