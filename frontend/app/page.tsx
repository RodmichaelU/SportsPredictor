import Link from "next/link";
import { getAccuracy, getParlays, getPredictions, getSports } from "@/lib/api";
import { pickConfidence } from "@/lib/format";
import { rankByValue } from "@/lib/valueBets";
import FeaturedMatchup from "@/components/FeaturedMatchup";
import GameTicker from "@/components/GameTicker";
import PickRow from "@/components/PickRow";
import Reveal from "@/components/Reveal";
import ScoreStrip from "@/components/ScoreStrip";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import { predictionsPath, resultsPath } from "@/lib/routes";

// The three-step version of the methodology; the full walkthrough (with
// the fitted curves and weights) lives on the Model page.
const STEPS = [
  {
    title: "Only pre-game facts",
    body: "Each prediction uses only what was known before kickoff: season form, Elo ratings, the betting line, rest. Nothing from the game itself ever leaks in.",
  },
  {
    title: "Simple, honest models",
    body: "A logistic regression picks the winner and a ridge regression projects the margin. Fancier models were tested and didn't beat them.",
  },
  {
    title: "Graded in public",
    body: "Every pick is frozen before the game and scored after it. No hindsight edits, so the Results page is the real track record.",
  },
];

export default async function HomePage() {
  const sports = await getSports();
  const liveSports = sports.filter((s) => s.status === "live");
  const primarySport = sports.find((s) => s.id === "cfb")?.id ?? sports[0]?.id ?? "cfb";
  const sportName = (id: string) => sports.find((s) => s.id === id)?.name ?? id.toUpperCase();

  const [accuracies, predictionsBySport, parlays] = await Promise.all([
    Promise.all(liveSports.map((s) => getAccuracy(s.id))),
    Promise.all(liveSports.map((s) => getPredictions(s.id))),
    getParlays(),
  ]);
  const parlayTiers = parlays?.tiers.filter((t) => t.available) ?? [];

  const liveStats = accuracies.filter((a) => a.sample_size > 0);

  // Every upcoming game across leagues, tagged with its sport so shared
  // components can link and look up logos correctly.
  const byConfidence = liveSports
    .flatMap((s, i) => predictionsBySport[i].map((p) => ({ p, sport: s.id })))
    .sort((a, b) => pickConfidence(b.p) - pickConfidence(a.p));
  const featured = byConfidence[0];
  const topPicks = byConfidence.slice(1, 7);
  const valuePicks = rankByValue(predictionsBySport[liveSports.findIndex((s) => s.id === primarySport)] ?? []).slice(0, 10);

  const stripGroups = liveSports.map((s, i) => ({
    sport: s.id,
    label: s.id.toUpperCase(),
    predictions: [...predictionsBySport[i]].sort((a, b) => a.game_date.localeCompare(b.game_date)).slice(0, 12),
  }));
  const hasStrip = stripGroups.some((g) => g.predictions.length > 0);

  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      <div>
        <ScoreStrip groups={stripGroups} />

        {/* Hero: one message, one featured game. */}
        <section className={`bleed relative overflow-hidden bg-ink-950 py-10 text-white sm:py-16 ${hasStrip ? "" : "-mt-8"}`}>
          <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0" />
          <div className="bleed-inner relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
            <div className="flex flex-col gap-6">
              <h1 className="display text-6xl sm:text-7xl">
                Every pick.
                <br />
                <span className="text-brand-500">Every reason.</span>
              </h1>
              <p className="max-w-md text-lg text-neutral-300">
                Machine-learning predictions built only from pre-game facts, graded honestly, and
                explained in plain English.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {sports.map((sport) => (
                  <Link
                    key={sport.id}
                    href={predictionsPath(sport.id)}
                    className={`eyebrow rounded-full px-4 py-2 text-xs transition duration-150 active:scale-[0.97] ${
                      sport.id === primarySport
                        ? "bg-brand-600 text-white hover:bg-brand-500"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {sport.name}
                  </Link>
                ))}
              </div>
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
            <div className="bleed-inner relative mt-12">
              <div className="eyebrow mb-3 text-xs text-neutral-400">Best value vs. the market</div>
              <GameTicker picks={valuePicks} sport={primarySport} />
            </div>
          )}
        </section>
      </div>

      {/* Track record, at a glance. */}
      {liveStats.length > 0 && (
        <Reveal as="section" className="grid grid-cols-3 gap-2 text-center sm:gap-6">
          {liveStats.map((a) => (
            <Link key={a.sport} href={resultsPath(a.sport)} className="group">
              <div className="display text-5xl tabular-nums sm:text-7xl">
                {Math.round((a.accuracy ?? 0) * 100)}
                <span className="text-brand-600 dark:text-brand-500">%</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500 group-hover:text-brand-600 sm:text-sm dark:group-hover:text-brand-400">
                <span className="sm:hidden">{a.sport.toUpperCase()}</span>
                <span className="hidden sm:inline">{sportName(a.sport)} accuracy</span> · {a.sample_size} games ›
              </div>
            </Link>
          ))}
        </Reveal>
      )}

      {topPicks.length > 0 && (
        <Reveal as="section">
          <SectionHeader title="Top picks this week" href={predictionsPath(primarySport)} linkLabel="All predictions" />
          <Panel className="py-1">
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              {topPicks.map(({ p, sport }) => (
                <PickRow key={`${sport}-${p.game_id}`} prediction={p} sport={sport} tag={sport.toUpperCase()} />
              ))}
            </div>
          </Panel>
        </Reveal>
      )}

      {parlayTiers.length > 0 && (
        <Reveal as="section">
          <SectionHeader title="Parlay Picker" href="/parlays" linkLabel="Build a parlay" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {parlayTiers.map((t) => (
              <Link
                key={t.tier}
                href="/parlays"
                className="group flex items-center justify-between gap-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-neutral-200/70 transition-shadow hover:shadow-lg dark:bg-ink-900 dark:ring-white/10"
              >
                <div>
                  <div className="eyebrow text-xs text-neutral-500 group-hover:text-brand-600 dark:group-hover:text-brand-400">{t.label}</div>
                  <div className="text-xs text-neutral-500">
                    {t.legs.length} legs · {Math.round(t.hit_probability! * 100)}% to hit
                  </div>
                </div>
                <div className="display text-4xl tabular-nums">
                  {t.american_odds! > 0 ? "+" : ""}
                  {t.american_odds!.toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal as="section">
        <SectionHeader title="How it works" href="/model" linkLabel="Full methodology" />
        <ol className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="display text-5xl text-brand-600 dark:text-brand-500">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="display text-2xl">{step.title}</h3>
              <p className="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </div>
  );
}
