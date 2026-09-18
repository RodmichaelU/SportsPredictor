import Link from "next/link";
import { getAccuracy, getModelCurve, getModelWeights, getPredictions, getSports } from "@/lib/api";
import CurveChart from "@/components/CurveChart";
import WeightBar from "@/components/WeightBar";
import GameTicker from "@/components/GameTicker";
import Reveal from "@/components/Reveal";

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
      {n}
    </span>
  );
}

export default async function HomePage() {
  const sports = await getSports();
  const primarySport = sports.find((s) => s.id === "cfb")?.id ?? sports[0]?.id ?? "cfb";

  const [weights, winCurve, marginCurve, accuracies, previewGames] = await Promise.all([
    getModelWeights(primarySport),
    getModelCurve(primarySport, "closing_spread", "win"),
    getModelCurve(primarySport, "closing_spread", "margin"),
    Promise.all(sports.map((s) => getAccuracy(s.id))),
    getPredictions(primarySport),
  ]);

  const topWeights = weights.weights.slice(0, 6);
  const maxAbsWeight = Math.max(...topWeights.map((w) => Math.abs(w.weight)), 0);
  const liveStats = accuracies.filter((a) => a.sample_size > 0);

  return (
    <div className="flex flex-col gap-20">
      {/* Hero */}
      <section className="-mx-6 -mt-8 bg-gradient-to-b from-indigo-50 to-neutral-50 px-6 pt-16 pb-14 dark:from-indigo-950/40 dark:to-neutral-950">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-700 uppercase dark:bg-indigo-900/50 dark:text-indigo-300">
            ML sports predictions, explained
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Predictions you can actually see the reasoning behind
          </h1>
          <p className="max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
            Every pick is built from stats that were true before kickoff, scored honestly after the
            fact, and broken down into plain-English reasons for why the model likes one team over
            the other.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {sports.map((sport) => (
              <Link
                key={sport.id}
                href={`/predictions?sport=${sport.id}`}
                className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                See {sport.name} picks →
              </Link>
            ))}
            <Link
              href="/model"
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Explore the model
            </Link>
          </div>
          {liveStats.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-500">
              {liveStats.map((a) => (
                <span key={a.sport}>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {Math.round((a.accuracy ?? 0) * 100)}%
                  </span>{" "}
                  accuracy on {a.sample_size} {a.sport.toUpperCase()} games so far
                </span>
              ))}
            </div>
          )}
        </div>

        {previewGames.length > 0 && (
          <div className="mt-10">
            <div className="mx-auto mb-2 w-max px-6 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
              This week&apos;s picks
            </div>
            <GameTicker predictions={previewGames.slice(0, 10)} sport={primarySport} />
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-14">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            No machine learning background required. Here&apos;s the actual pipeline, in plain
            English, with the real math shown alongside it.
          </p>
        </div>

        <div className="flex flex-col gap-12">
          {/* Step 1: data */}
          <Reveal className="flex gap-4">
            <StepBadge n={1} />
            <div>
              <h3 className="text-xl font-semibold">Start with what was true before kickoff</h3>
              <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
                Every game gets built from things that were already known before the ball was
                snapped: each team&apos;s scoring efficiency this season, the closing betting line,
                recruiting rankings, rest days, home field. Nothing from after the game starts ever
                touches a prediction -- that&apos;s the one rule that keeps this honest. A model that
                peeks at the result would look brilliant and mean nothing.
              </p>
            </div>
          </Reveal>

          {/* Step 2: Elo */}
          <Reveal className="flex gap-4">
            <StepBadge n={2} />
            <div>
              <h3 className="text-xl font-semibold">A baseline: Elo ratings</h3>
              <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
                Think of it like a chess ranking. Every team starts at the same rating. Win, and your
                rating climbs -- more if you beat a good team, less if you beat a weak one. Lose, and
                it falls the same way. No box scores or advanced stats needed, just wins and losses
                against the right opponents, and after enough games the ratings settle into a
                genuinely useful read on how good a team is right now. We build this from scratch and
                treat it as the floor: anything fancier has to actually beat it to justify existing.
              </p>
            </div>
          </Reveal>

          {/* Step 3: logistic regression + S-curve */}
          <Reveal className="flex gap-4">
            <StepBadge n={3} />
            <div className="flex-1">
              <h3 className="text-xl font-semibold">Win probability: logistic regression</h3>
              <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
                This is the model that actually picks winners. It takes a dozen-plus stats -- the Elo
                gap, the betting line, recent offense and defense, rest, recruiting talent -- and
                turns them into a single percentage. Below is the real fitted curve: as the betting
                line moves from a big home underdog to a big home favorite, the predicted win
                probability traces an S-shape, not a straight line. That&apos;s the model correctly
                refusing to ever predict below 0% or above 100% -- it naturally flattens out at the
                extremes instead of running off to nonsense values.
              </p>
              <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <CurveChart curve={winCurve.curve} scatter={winCurve.scatter} target="win" xLabel={winCurve.label} />
              </div>
            </div>
          </Reveal>

          {/* Step 4: ridge regression + line */}
          <Reveal className="flex gap-4">
            <StepBadge n={4} />
            <div className="flex-1">
              <h3 className="text-xl font-semibold">Predicted margin: ridge regression</h3>
              <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
                A close cousin of the win-probability model, but instead of a percentage it predicts
                the final score margin -- how many points a team should win or lose by. This one really
                is a straight line, because ridge regression is linear: for every extra point on the
                closing spread, the predicted margin shifts by a fixed amount the model learned from
                thousands of past games.
              </p>
              <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <CurveChart
                  curve={marginCurve.curve}
                  scatter={marginCurve.scatter}
                  target="margin"
                  xLabel={marginCurve.label}
                />
              </div>
            </div>
          </Reveal>

          {/* Step 5: why not fancier */}
          <Reveal className="flex gap-4">
            <StepBadge n={5} />
            <div className="flex-1">
              <h3 className="text-xl font-semibold">Why not something fancier?</h3>
              <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
                We also tried gradient boosting (XGBoost) -- a more powerful model built from decision
                trees that can learn complicated combinations of stats, like &quot;teams with a big
                Elo edge <em>and</em> extra rest <em>and</em> a road environment.&quot; It&apos;s a
                great tool when you have huge amounts of data. Football doesn&apos;t give you that: a
                team plays somewhere between 12 and 17 games a season. Hand a complicated model that
                little data and it starts memorizing noise instead of learning real patterns. When we
                actually compared them, the two simpler statistical models above matched or beat the
                tree model -- so those are what generate every pick in this app. The tree model still
                gets trained for comparison, but it never touches a live prediction.
              </p>
              {topWeights.length > 0 && (
                <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="mb-3 text-sm text-neutral-500">
                    The {sports.find((s) => s.id === primarySport)?.name} model&apos;s biggest
                    factors:
                  </div>
                  <div className="flex flex-col gap-3">
                    {topWeights.map((w) => (
                      <WeightBar key={w.feature} weight={w} maxAbsWeight={maxAbsWeight} />
                    ))}
                  </div>
                  <Link
                    href={`/model?sport=${primarySport}`}
                    className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    See the full breakdown →
                  </Link>
                </div>
              )}
            </div>
          </Reveal>

          {/* Step 6: grading */}
          <Reveal className="flex gap-4">
            <StepBadge n={6} />
            <div>
              <h3 className="text-xl font-semibold">Graded honestly, every week</h3>
              <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
                Every prediction is frozen -- saved before kickoff -- and never touched again, even
                once we know who won. After the game ends, it gets scored against what actually
                happened. The Results page for each league is that scoreboard: not the model bragging
                with hindsight, but every pick checked against the same rule any honest forecaster has
                to follow.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <Reveal
        as="section"
        className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 className="text-2xl font-bold tracking-tight">See it in action</h2>
        <p className="max-w-lg text-neutral-600 dark:text-neutral-400">
          Every game&apos;s prediction has its own &quot;Why?&quot; page with the exact factors that
          drove it -- the same idea as above, applied to one matchup.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {sports.map((sport) => (
            <Link
              key={sport.id}
              href={`/predictions?sport=${sport.id}`}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              {sport.name} predictions
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
