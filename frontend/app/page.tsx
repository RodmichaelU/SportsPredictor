import Link from "next/link";
import {
  getAccuracy,
  getModelCurve,
  getModelWeights,
  getPredictions,
  getResults,
  getSports,
} from "@/lib/api";
import { pickConfidence } from "@/lib/format";
import { rankByUpset } from "@/lib/upsets";
import { rankByValue } from "@/lib/valueBets";
import CurveChart from "@/components/CurveChart";
import FeaturedMatchup from "@/components/FeaturedMatchup";
import GameTicker from "@/components/GameTicker";
import PickRow from "@/components/PickRow";
import Reveal from "@/components/Reveal";
import ScoreStrip from "@/components/ScoreStrip";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import TeamBadge from "@/components/TeamBadge";
import WeightBar from "@/components/WeightBar";

function StepTile({
  n,
  title,
  children,
  className = "",
  dark = false,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <Reveal
      className={`relative flex flex-col gap-3 overflow-hidden rounded-md p-6 ${
        dark
          ? "bg-ink-950 text-white"
          : "border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-ink-900"
      } ${className}`}
    >
      {/* Oversized step number bleeding off the tile's corner. */}
      <span
        aria-hidden
        className={`display pointer-events-none absolute -top-3 -right-1 text-[7rem] leading-none ${
          dark ? "text-white/5" : "text-neutral-900/[0.04] dark:text-white/[0.04]"
        }`}
      >
        {String(n).padStart(2, "0")}
      </span>
      <span className="eyebrow text-[11px] text-brand-600 dark:text-brand-400">Step {String(n).padStart(2, "0")}</span>
      <h3 className="display text-3xl">{title}</h3>
      <div className={`flex flex-col gap-4 text-[15px] leading-relaxed ${dark ? "text-neutral-300" : "text-neutral-600 dark:text-neutral-400"}`}>
        {children}
      </div>
    </Reveal>
  );
}

export default async function HomePage() {
  const sports = await getSports();
  const liveSports = sports.filter((s) => s.status === "live");
  const primarySport = sports.find((s) => s.id === "cfb")?.id ?? sports[0]?.id ?? "cfb";
  const sportName = (id: string) => sports.find((s) => s.id === id)?.name ?? id.toUpperCase();

  const [weights, winCurve, marginCurve, accuracies, predictionsBySport, resultsBySport] = await Promise.all([
    getModelWeights(primarySport),
    getModelCurve(primarySport, "closing_spread", "win"),
    getModelCurve(primarySport, "closing_spread", "margin"),
    Promise.all(sports.map((s) => getAccuracy(s.id))),
    Promise.all(liveSports.map((s) => getPredictions(s.id))),
    Promise.all(liveSports.map((s) => getResults(s.id))),
  ]);

  const topWeights = weights.weights.slice(0, 6);
  const maxAbsWeight = Math.max(...topWeights.map((w) => Math.abs(w.weight)), 0);
  const liveStats = accuracies.filter((a) => a.sample_size > 0);

  // Every upcoming game across leagues, tagged with its sport so shared
  // components can link and look up logos correctly.
  const allUpcoming = liveSports.flatMap((s, i) => predictionsBySport[i].map((p) => ({ p, sport: s.id })));
  const byConfidence = [...allUpcoming].sort((a, b) => pickConfidence(b.p) - pickConfidence(a.p));
  const valuePicks = rankByValue(predictionsBySport[liveSports.findIndex((s) => s.id === primarySport)] ?? []).slice(0, 10);

  const featured = byConfidence[0];
  const topPicks = byConfidence.slice(featured ? 1 : 0, 15);
  const upsets = liveSports
    .flatMap((s, i) => rankByUpset(resultsBySport[i]).slice(0, 3).map((u) => ({ ...u, sport: s.id })))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const stripGroups = liveSports.map((s, i) => ({
    sport: s.id,
    label: s.id.toUpperCase(),
    predictions: [...predictionsBySport[i]].sort((a, b) => a.game_date.localeCompare(b.game_date)).slice(0, 12),
  }));

  return (
    <div className="flex flex-col gap-14">
      <div>
        <ScoreStrip groups={stripGroups} />

        {/* Hero: pitch on the left, the week's strongest pick on the right. */}
        <section className={`bleed relative overflow-hidden bg-ink-950 pt-12 pb-10 text-white ${stripGroups.some((g) => g.predictions.length) ? "" : "-mt-8"}`}>
          <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0 opacity-60" />
          <div className="bleed-inner relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-6">
              <span className="eyebrow flex items-center gap-2 text-brand-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                ML sports predictions, explained
              </span>
              <h1 className="display text-5xl sm:text-7xl">
                Every pick. <span className="text-brand-500">Every reason.</span>
              </h1>
              <p className="max-w-xl text-lg text-neutral-300">
                Every pick is built from stats that were true before kickoff, scored honestly after the
                fact, and broken down into plain-English reasons for why the model likes one team over
                the other.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {sports.map((sport) => (
                  <Link
                    key={sport.id}
                    href={`/predictions?sport=${sport.id}`}
                    className="eyebrow rounded-sm bg-brand-600 px-5 py-3 text-sm text-white transition duration-150 ease-out hover:bg-brand-500 active:scale-[0.97]"
                  >
                    {sport.name} picks ›
                  </Link>
                ))}
                <Link
                  href="/model"
                  className="eyebrow rounded-sm border border-white/25 px-5 py-3 text-sm text-white transition duration-150 ease-out hover:bg-white/10 active:scale-[0.97]"
                >
                  Explore the model
                </Link>
              </div>
              {liveStats.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6">
                  {liveStats.map((a) => (
                    <div key={a.sport}>
                      <div className="display text-4xl tabular-nums">
                        {Math.round((a.accuracy ?? 0) * 100)}
                        <span className="text-brand-500">%</span>
                      </div>
                      <div className="eyebrow mt-1 text-[11px] text-neutral-400">
                        {a.sport.toUpperCase()} accuracy · {a.sample_size} games
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {featured && (
              <FeaturedMatchup
                prediction={featured.p}
                sport={featured.sport}
                label="Strongest pick this week"
                sportLabel={featured.sport.toUpperCase()}
              />
            )}
          </div>

          {valuePicks.length > 0 && (
            <div className="bleed-inner relative mt-10">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="eyebrow text-white">Best value this week</span>
                <span className="text-xs text-neutral-400">
                  Where our model and the live market disagree most, ranked by expected return
                </span>
              </div>
              <GameTicker picks={valuePicks} sport={primarySport} />
            </div>
          )}
        </section>
      </div>

      {/* Front-page modules: top picks feed + scorecard sidebar. */}
      {(topPicks.length > 0 || liveStats.length > 0) && (
        <section className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <Reveal>
            <SectionHeader eyebrow="All leagues" title="Top picks this week" href={`/predictions?sport=${primarySport}`} linkLabel="All predictions" />
            <Panel className="py-1">
              {topPicks.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-500">No upcoming games right now.</p>
              ) : (
                <div className="grid gap-x-8 md:grid-cols-2">
                  {topPicks.map(({ p, sport }, i) => (
                    <PickRow key={`${sport}-${p.game_id}`} prediction={p} sport={sport} rank={i + 2} tag={sport.toUpperCase()} />
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>

          <Reveal delayMs={100} className="flex flex-col gap-8">
            {liveStats.length > 0 && (
              <div>
                <SectionHeader title="Model scorecard" size="sm" />
                <Panel className="flex flex-col gap-4">
                  {liveStats.map((a) => {
                    const pct = Math.round((a.accuracy ?? 0) * 100);
                    return (
                      <Link key={a.sport} href={`/results?sport=${a.sport}`} className="group">
                        <div className="flex items-baseline justify-between">
                          <span className="eyebrow text-xs group-hover:text-brand-600 dark:group-hover:text-brand-400">{sportName(a.sport)}</span>
                          <span className="display text-2xl tabular-nums">{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                          <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500">{a.sample_size} graded games</div>
                      </Link>
                    );
                  })}
                </Panel>
              </div>
            )}

            {upsets.length > 0 && (
              <div>
                <SectionHeader title="Biggest misses" size="sm" />
                <Panel className="py-1">
                  {upsets.map(({ result: r, confidence, sport }) => (
                    <Link
                      key={`${sport}-${r.game_id}`}
                      href={`/games/${r.game_id}?sport=${sport}`}
                      className="group flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0 dark:border-white/5"
                    >
                      <TeamBadge team={r.actual_winner} sport={sport} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {r.actual_winner} {Math.max(r.home_score, r.away_score)}–{Math.min(r.home_score, r.away_score)}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          Model had {r.predicted_winner} at {Math.round(confidence * 100)}%
                        </div>
                      </div>
                      <span className="eyebrow shrink-0 text-[10px] text-neutral-400">{sport.toUpperCase()}</span>
                    </Link>
                  ))}
                </Panel>
              </div>
            )}
          </Reveal>
        </section>
      )}

      {/* How it works, as a bento grid rather than a long column of steps. */}
      <section>
        <SectionHeader eyebrow="Under the hood" title="How it works" href="/model" linkLabel="Model details" />
        <p className="mb-6 max-w-2xl text-neutral-600 dark:text-neutral-400">
          No machine learning background required. Here&apos;s the actual pipeline, in plain English,
          with the real math shown alongside it.
        </p>

        <div className="grid gap-4 lg:grid-cols-6">
          <StepTile n={1} title="Start with what was true before kickoff" className="lg:col-span-3">
            <p>
              Every game gets built from things that were already known before the ball was snapped:
              each team&apos;s scoring efficiency this season, the closing betting line, recruiting
              rankings, rest days, home field. Nothing from after the game starts ever touches a
              prediction -- that&apos;s the one rule that keeps this honest. A model that peeks at the
              result would look brilliant and mean nothing.
            </p>
          </StepTile>

          <StepTile n={2} title="A baseline: Elo ratings" className="lg:col-span-3">
            <p>
              Think of it like a chess ranking. Every team starts at the same rating. Win, and your
              rating climbs -- more if you beat a good team, less if you beat a weak one. Lose, and it
              falls the same way. No box scores or advanced stats needed, just wins and losses against
              the right opponents, and after enough games the ratings settle into a genuinely useful
              read on how good a team is right now. We build this from scratch and treat it as the
              floor: anything fancier has to actually beat it to justify existing.
            </p>
          </StepTile>

          <StepTile n={3} title="Win probability: logistic regression" className="lg:col-span-3">
            <p>
              This is the model that actually picks winners. It takes a dozen-plus stats -- the Elo
              gap, the betting line, recent offense and defense, rest, recruiting talent -- and turns
              them into a single percentage. Below is the real fitted curve: as the betting line moves
              from a big home underdog to a big home favorite, the predicted win probability traces an
              S-shape, not a straight line. That&apos;s the model correctly refusing to ever predict
              below 0% or above 100% -- it naturally flattens out at the extremes instead of running
              off to nonsense values.
            </p>
            <div className="mt-auto rounded-md bg-neutral-50 p-3 dark:bg-ink-950">
              <CurveChart curve={winCurve.curve} scatter={winCurve.scatter} target="win" xLabel={winCurve.label} />
            </div>
          </StepTile>

          <StepTile n={4} title="Predicted margin: ridge regression" className="lg:col-span-3">
            <p>
              A close cousin of the win-probability model, but instead of a percentage it predicts the
              final score margin -- how many points a team should win or lose by. This one really is a
              straight line, because ridge regression is linear: for every extra point on the closing
              spread, the predicted margin shifts by a fixed amount the model learned from thousands
              of past games.
            </p>
            <div className="mt-auto rounded-md bg-neutral-50 p-3 dark:bg-ink-950">
              <CurveChart curve={marginCurve.curve} scatter={marginCurve.scatter} target="margin" xLabel={marginCurve.label} />
            </div>
          </StepTile>

          <StepTile n={5} title="Why not something fancier?" className="lg:col-span-4">
            <p>
              We also tried gradient boosting (XGBoost) -- a more powerful model built from decision
              trees that can learn complicated combinations of stats, like &quot;teams with a big Elo
              edge <em>and</em> extra rest <em>and</em> a road environment.&quot; It&apos;s a great
              tool when you have huge amounts of data. Football doesn&apos;t give you that: a team
              plays somewhere between 12 and 17 games a season. Hand a complicated model that little
              data and it starts memorizing noise instead of learning real patterns. When we actually
              compared them, the two simpler statistical models above matched or beat the tree model
              -- so those are what generate every pick in this app. The tree model still gets trained
              for comparison, but it never touches a live prediction.
            </p>
            {topWeights.length > 0 && (
              <div className="rounded-md bg-neutral-50 p-4 dark:bg-ink-950">
                <div className="eyebrow mb-3 text-[11px] text-neutral-500">
                  The {sportName(primarySport)} model&apos;s biggest factors
                </div>
                <div className="flex flex-col gap-3">
                  {topWeights.map((w) => (
                    <WeightBar key={w.feature} weight={w} maxAbsWeight={maxAbsWeight} />
                  ))}
                </div>
              </div>
            )}
          </StepTile>

          <StepTile n={6} title="Graded honestly, every week" className="lg:col-span-2" dark>
            <p>
              Every prediction is frozen -- saved before kickoff -- and never touched again, even once
              we know who won. After the game ends, it gets scored against what actually happened. The
              Results page for each league is that scoreboard: not the model bragging with hindsight,
              but every pick checked against the same rule any honest forecaster has to follow.
            </p>
            <div className="mt-auto flex flex-col gap-2">
              {liveSports.map((s) => (
                <Link
                  key={s.id}
                  href={`/results?sport=${s.id}`}
                  className="eyebrow flex items-center justify-between rounded-sm bg-white/5 px-3 py-2.5 text-xs text-white hover:bg-white/10"
                >
                  {s.name} results <span className="text-brand-400">›</span>
                </Link>
              ))}
            </div>
          </StepTile>
        </div>
      </section>

      {/* Closing CTA */}
      <Reveal
        as="section"
        className="relative flex flex-col items-center gap-4 overflow-hidden rounded-md bg-ink-950 px-6 py-14 text-center text-white shadow-[inset_0_4px_0_0_var(--color-brand-600)]"
      >
        <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0 opacity-50" />
        <h2 className="display relative text-4xl sm:text-5xl">See it in action</h2>
        <p className="relative max-w-lg text-neutral-300">
          Every game&apos;s prediction has its own &quot;Why?&quot; page with the exact factors that
          drove it -- the same idea as above, applied to one matchup.
        </p>
        <div className="relative flex flex-wrap items-center justify-center gap-3">
          {sports.map((sport) => (
            <Link
              key={sport.id}
              href={`/predictions?sport=${sport.id}`}
              className="eyebrow rounded-sm bg-brand-600 px-5 py-3 text-sm text-white transition duration-150 ease-out hover:bg-brand-500 active:scale-[0.97]"
            >
              {sport.name} predictions ›
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
