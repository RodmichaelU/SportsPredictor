import type { Metadata } from "next";
import Link from "next/link";
import { getExplanation, getGameIds, getSports, getTeamSlugs } from "@/lib/api";
import { predictionsPath, teamPath } from "@/lib/routes";
import { formatPercent, pickConfidence } from "@/lib/format";
import ProbabilityDuel from "@/components/ProbabilityDuel";
import ExplanationFactor from "@/components/ExplanationFactor";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import TeamBadge from "@/components/TeamBadge";

// Pre-built for every game with a prediction or result, in every live league.
export async function generateStaticParams() {
  const sports = (await getSports()).filter((s) => s.status === "live");
  const ids = await Promise.all(sports.map((s) => getGameIds(s.id)));
  return sports.flatMap((s, i) => ids[i].map((gameId) => ({ sport: s.id, gameId })));
}
export const dynamicParams = false;

// Reads the same exported file the page below does (lib/api.ts memoizes it).
export async function generateMetadata(props: PageProps<"/games/[sport]/[gameId]">): Promise<Metadata> {
  const { sport, gameId } = await props.params;

  try {
    const data = await getExplanation(sport, gameId);
    const confidence = formatPercent(pickConfidence(data));
    return {
      title: `${data.away_team} @ ${data.home_team}`,
      description: `The model picks ${data.predicted_winner} (${confidence}) -- see the factors driving the pick.`,
    };
  } catch {
    return { title: "Game prediction" };
  }
}

export default async function GameExplanationPage(props: PageProps<"/games/[sport]/[gameId]">) {
  const { sport, gameId } = await props.params;

  const [data, slugs] = await Promise.all([getExplanation(sport, gameId), getTeamSlugs(sport)]);
  const maxAbsContribution = Math.max(...data.groups.map((g) => Math.abs(g.contribution)), 0);

  const homePct = data.win_probability;
  const homeIsPick = data.predicted_winner === data.home_team;
  const confidence = pickConfidence(data);
  const marketPick =
    data.market_home_probability === null ? null : homeIsPick ? data.market_home_probability : 1 - data.market_home_probability;

  return (
    <div className="flex flex-col gap-14">
      {/* Matchup banner: the two teams squared off across the full width. */}
      <section className="bleed relative -mt-8 overflow-hidden bg-ink-950 text-white">
        <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="bleed-inner relative py-8">
          <Link href={predictionsPath(sport)} className="eyebrow text-xs text-neutral-400 hover:text-white">
            ‹ Back to predictions
          </Link>
          <h1 className="sr-only">
            {data.away_team} @ {data.home_team}
          </h1>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
            {[
              { team: data.away_team, pct: 1 - homePct, isPick: !homeIsPick, side: "Away", align: "items-start text-left" },
              null,
              { team: data.home_team, pct: homePct, isPick: homeIsPick, side: "Home", align: "items-end text-right" },
            ].map((t, i) =>
              t === null ? (
                <div key="vs" className="flex flex-col items-center gap-2">
                  <span className="display text-3xl text-neutral-600 sm:text-5xl">@</span>
                </div>
              ) : (
                <Link
                  key={t.team}
                  href={slugs[t.team] ? teamPath(sport, slugs[t.team]) : predictionsPath(sport)}
                  className={`group flex min-w-0 flex-col gap-3 ${t.align}`}
                >
                  <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 ${i === 2 ? "items-end sm:flex-row-reverse" : "items-start"}`}>
                    <TeamBadge team={t.team} sport={sport} size="xl" />
                    <span className={`display text-5xl tabular-nums sm:text-8xl ${t.isPick ? "" : "text-neutral-600"}`}>
                      {Math.round(t.pct * 100)}
                      <span className={`text-3xl sm:text-5xl ${t.isPick ? "text-brand-500" : ""}`}>%</span>
                    </span>
                  </div>
                  <div className="min-w-0 max-w-full">
                    <div className="eyebrow text-[11px] text-neutral-500">
                      {t.side}
                      {t.isPick && <span className="ml-2 rounded-sm bg-brand-600 px-1.5 py-px text-white">Pick</span>}
                    </div>
                    <div className="display truncate text-xl group-hover:text-brand-400 sm:text-4xl">{t.team}</div>
                  </div>
                </Link>
              )
            )}
          </div>
          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-white/10">
            <div className={homeIsPick ? "bg-neutral-600" : "bg-brand-500"} style={{ width: `${(1 - homePct) * 100}%` }} />
            <div className={homeIsPick ? "bg-brand-500" : "bg-neutral-600"} style={{ width: `${homePct * 100}%` }} />
          </div>
          <p className="mt-3 text-center text-xs text-neutral-400">Win probability, as of when this prediction was frozen</p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-14">
        <section>
          <SectionHeader title={`Why ${data.predicted_winner}?`} />
          <p className="mb-5 text-sm text-neutral-500">
            Bar length shows how much each factor moved the prediction; tap a row for the underlying
            numbers. Related stats are grouped together, since a factor&apos;s combined effect is more
            reliable than its parts taken individually.
          </p>
          <Panel className="py-1">
            {data.groups.map((group) => (
              <ExplanationFactor
                key={group.key}
                group={group}
                homeTeam={data.home_team}
                maxAbsContribution={maxAbsContribution}
              />
            ))}
          </Panel>
        </section>

        {data.market_home_probability !== null && marketPick !== null && (
          <section>
            <SectionHeader
              title="What the market thinks"
              eyebrow={`${confidence >= marketPick ? "+" : ""}${Math.round((confidence - marketPick) * 100)} pts vs. our model`}
            />
            <Panel className="p-4 sm:p-6">
              <ProbabilityDuel
                homeTeam={data.home_team}
                awayTeam={data.away_team}
                sport={sport}
                winProbability={data.market_home_probability}
                caption="Live implied probability from Kalshi's real-money prediction market"
              />
            </Panel>
          </section>
        )}

        <p className="text-center text-xs text-neutral-500">Model version {data.model_version}.</p>
      </div>
    </div>
  );
}
