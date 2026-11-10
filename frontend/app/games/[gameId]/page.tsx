import type { Metadata } from "next";
import Link from "next/link";
import { getExplanation } from "@/lib/api";
import { formatPercent, pickConfidence } from "@/lib/format";
import ProbabilityDuel from "@/components/ProbabilityDuel";
import ExplanationFactor from "@/components/ExplanationFactor";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import TeamBadge from "@/components/TeamBadge";

// Reuses the same getExplanation call the page below makes -- Next
// memoizes fetches with identical args across generateMetadata and the
// page component in one request, so this doesn't cost a second round-trip.
export async function generateMetadata(props: PageProps<"/games/[gameId]">): Promise<Metadata> {
  const { gameId } = await props.params;
  const searchParams = await props.searchParams;
  const sport = (searchParams.sport as string) ?? "cfb";

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

export default async function GameExplanationPage(props: PageProps<"/games/[gameId]">) {
  const { gameId } = await props.params;
  const searchParams = await props.searchParams;
  const sport = (searchParams.sport as string) ?? "cfb";

  const data = await getExplanation(sport, gameId);
  const maxAbsContribution = Math.max(...data.groups.map((g) => Math.abs(g.contribution)), 0);

  const homePct = data.win_probability;
  const homeIsPick = data.predicted_winner === data.home_team;
  const confidence = pickConfidence(data);
  const marketPick =
    data.market_home_probability === null ? null : homeIsPick ? data.market_home_probability : 1 - data.market_home_probability;

  return (
    <div className="flex flex-col gap-10">
      {/* Matchup banner: the two teams squared off across the full width. */}
      <section className="bleed relative -mt-8 overflow-hidden bg-ink-950 text-white">
        <div aria-hidden className="broadcast-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="bleed-inner relative py-8">
          <Link href={`/predictions?sport=${sport}`} className="eyebrow text-xs text-neutral-400 hover:text-white">
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
                  href={`/teams/${encodeURIComponent(t.team)}?sport=${sport}`}
                  className={`group flex min-w-0 flex-col gap-3 ${t.align}`}
                >
                  <div className={`flex items-center gap-4 ${i === 2 ? "flex-row-reverse" : ""}`}>
                    <TeamBadge team={t.team} sport={sport} size="xl" />
                    <span className={`display text-6xl tabular-nums sm:text-8xl ${t.isPick ? "" : "text-neutral-600"}`}>
                      {Math.round(t.pct * 100)}
                      <span className={`text-3xl sm:text-5xl ${t.isPick ? "text-brand-500" : ""}`}>%</span>
                    </span>
                  </div>
                  <div className="min-w-0 max-w-full">
                    <div className="eyebrow text-[11px] text-neutral-500">
                      {t.side}
                      {t.isPick && <span className="ml-2 rounded-sm bg-brand-600 px-1.5 py-px text-white">Pick</span>}
                    </div>
                    <div className="display truncate text-2xl group-hover:text-brand-400 sm:text-4xl">{t.team}</div>
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

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
        <section>
          <SectionHeader eyebrow="The breakdown" title={`Why the model picked ${data.predicted_winner}`} />
          <p className="mb-4 text-sm text-neutral-500">
            Bar length shows how much each factor moved the prediction. Click a row for the underlying
            numbers. Some stats are correlated with each other (a team&apos;s overall rating already
            reflects its offense and defense), so they&apos;re grouped together here -- a factor&apos;s
            combined effect is more reliable than its parts taken individually.
          </p>
          <Panel className="py-0">
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

        <aside className="flex flex-col gap-8 lg:sticky lg:top-28">
          <div>
            <SectionHeader title="The numbers" size="sm" />
            <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-neutral-200 p-0 dark:bg-white/10">
              {[
                { label: "Pick", value: data.predicted_winner },
                { label: "Confidence", value: formatPercent(confidence) },
                { label: "Market", value: marketPick === null ? "—" : formatPercent(marketPick) },
                {
                  label: "Edge",
                  value: marketPick === null ? "—" : `${confidence >= marketPick ? "+" : ""}${Math.round((confidence - marketPick) * 100)}`,
                },
              ].map((s) => (
                <div key={s.label} className="min-w-0 bg-white p-3 dark:bg-ink-900">
                  <div className="eyebrow text-[10px] text-neutral-400">{s.label}</div>
                  <div className="display mt-0.5 truncate text-2xl">{s.value}</div>
                </div>
              ))}
            </Panel>
          </div>

          {data.market_home_probability !== null && (
            <div>
              <SectionHeader title="Live market (Kalshi)" size="sm" />
              <Panel>
                <ProbabilityDuel
                  homeTeam={data.home_team}
                  awayTeam={data.away_team}
                  sport={sport}
                  winProbability={data.market_home_probability}
                  caption="Live implied probability from Kalshi's real-money prediction market"
                />
              </Panel>
            </div>
          )}

          <div>
            <SectionHeader title="Team pages" size="sm" />
            <Panel className="py-1">
              {[data.away_team, data.home_team].map((t) => (
                <Link
                  key={t}
                  href={`/teams/${encodeURIComponent(t)}?sport=${sport}`}
                  className="group flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0 dark:border-white/5"
                >
                  <TeamBadge team={t} sport={sport} size="md" />
                  <span className="flex-1 truncate text-sm font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-400">{t}</span>
                  <span className="text-brand-600 dark:text-brand-400">›</span>
                </Link>
              ))}
            </Panel>
          </div>

          <p className="text-xs text-neutral-500">Model version {data.model_version}.</p>
        </aside>
      </div>
    </div>
  );
}
