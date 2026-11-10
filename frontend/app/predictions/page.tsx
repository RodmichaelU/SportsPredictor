import Link from "next/link";
import { getPredictions, getSports } from "@/lib/api";
import { Prediction } from "@/lib/types";
import { formatGameDate, formatMargin, pickConfidence } from "@/lib/format";
import PredictionCard from "@/components/PredictionCard";
import ComingSoon from "@/components/ComingSoon";
import FeaturedMatchup from "@/components/FeaturedMatchup";
import MarketDisagreements from "@/components/MarketDisagreements";
import PageBand, { BandStat } from "@/components/PageBand";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import TeamBadge from "@/components/TeamBadge";
import Reveal from "@/components/Reveal";

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// A small bento tile spotlighting one game for one reason (closest call,
// biggest blowout): the reason as the headline, the matchup underneath.
function SpotlightTile({ label, stat, prediction: p, sport }: { label: string; stat: string; prediction: Prediction; sport: string }) {
  return (
    <Link
      href={`/games/${p.game_id}?sport=${sport}`}
      className="group flex flex-col justify-between gap-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-ink-900"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="eyebrow text-[11px] text-brand-600 dark:text-brand-400">{label}</span>
        <span className="display text-4xl leading-none tabular-nums">{stat}</span>
      </div>
      <div className="flex items-center gap-2">
        <TeamBadge team={p.away_team} sport={sport} size="sm" />
        <TeamBadge team={p.home_team} sport={sport} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-400">
          {p.away_team} @ {p.home_team}
        </span>
      </div>
      <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{formatGameDate(p.game_date)}</span>
    </Link>
  );
}

export default async function PredictionsPage(props: PageProps<"/predictions">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const predictions = await getPredictions(sport);
  const sorted = [...predictions].sort((a, b) => a.game_date.localeCompare(b.game_date));
  const byConfidence = [...predictions].sort((a, b) => pickConfidence(b) - pickConfidence(a));
  const strongest = byConfidence[0];
  const closest = byConfidence[byConfidence.length - 1];
  const blowout = [...predictions].sort((a, b) => Math.abs(b.predicted_margin) - Math.abs(a.predicted_margin))[0];
  const withMarket = predictions.filter((p) => p.market_home_probability !== null).length;
  const avgConfidence = predictions.length
    ? predictions.reduce((sum, p) => sum + pickConfidence(p), 0) / predictions.length
    : 0;

  const days: { day: string; games: Prediction[] }[] = [];
  for (const p of sorted) {
    const day = dayKey(p.game_date);
    if (days.at(-1)?.day !== day) days.push({ day, games: [] });
    days.at(-1)!.games.push(p);
  }

  // Confidence spread: how many picks land in each 10-point band.
  const bands = [50, 60, 70, 80, 90].map((lo) => ({
    lo,
    count: predictions.filter((p) => {
      const c = pickConfidence(p) * 100;
      return c >= lo && (lo === 90 ? c <= 100 : c < lo + 10);
    }).length,
  }));
  const maxBand = Math.max(...bands.map((b) => b.count), 1);

  return (
    <div className="flex flex-col gap-10">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="Upcoming predictions"
        description={
          <>
            Predictions are frozen before kickoff and never recomputed after the result is known.{" "}
            <span className="font-semibold text-white">Model</span> is our own prediction, trained on each
            team&apos;s historical stats (
            <Link href={`/model?sport=${sport}`} className="underline decoration-white/30 underline-offset-2 hover:text-brand-400">
              see how
            </Link>
            ). <span className="font-semibold text-white">Market</span> is the live price from Kalshi, a
            real-money prediction market -- real people trading real dollars on the outcome, not another model.
          </>
        }
        aside={
          predictions.length > 0 && (
            <div className="flex gap-10">
              <BandStat value={predictions.length} label="Games" />
              <BandStat value={`${Math.round(avgConfidence * 100)}%`} label="Avg confidence" accent />
              <BandStat value={withMarket} label="Market lines" />
            </div>
          )
        }
      />

      {predictions.length === 0 ? (
        <p className="text-sm text-neutral-500">No upcoming predictions for this sport yet.</p>
      ) : (
        <>
          {/* Featured bento: the strongest pick large, two spotlights beside it. */}
          <Reveal className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <FeaturedMatchup prediction={strongest} sport={sport} label="Strongest pick" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {closest && closest.game_id !== strongest.game_id && (
                <SpotlightTile label="Closest call" stat={`${Math.round(pickConfidence(closest) * 100)}%`} prediction={closest} sport={sport} />
              )}
              {blowout && (
                <SpotlightTile label="Biggest projected margin" stat={formatMargin(blowout.predicted_margin)} prediction={blowout} sport={sport} />
              )}
            </div>
          </Reveal>

          <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
            {/* Main feed, grouped by game day. */}
            <div className="flex flex-col gap-10">
              {days.map(({ day, games }) => (
                <Reveal key={day}>
                  <SectionHeader eyebrow={`${games.length} game${games.length === 1 ? "" : "s"}`} title={day} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {games.map((p) => (
                      <PredictionCard key={p.game_id} prediction={p} sport={sport} />
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Sticky sidebar. */}
            <aside className="flex flex-col gap-8 lg:sticky lg:top-28">
              <MarketDisagreements predictions={predictions} sport={sport} />

              <div>
                <SectionHeader title="Confidence spread" size="sm" />
                <Panel className="flex flex-col gap-2">
                  {bands.map((b) => (
                    <div key={b.lo} className="flex items-center gap-3 text-xs">
                      <span className="w-14 shrink-0 font-semibold text-neutral-500 tabular-nums">
                        {b.lo}{b.lo === 90 ? "+" : `–${b.lo + 9}`}%
                      </span>
                      <div className="h-4 flex-1 overflow-hidden rounded-sm bg-neutral-100 dark:bg-white/5">
                        <div className="h-full bg-brand-600" style={{ width: `${(b.count / maxBand) * 100}%`, opacity: 0.45 + (b.lo - 50) / 80 }} />
                      </div>
                      <span className="w-6 shrink-0 text-right font-bold tabular-nums">{b.count}</span>
                    </div>
                  ))}
                  <p className="mt-1 text-[11px] text-neutral-500">How sure the model is across this slate of games.</p>
                </Panel>
              </div>

              <div>
                <SectionHeader title="Reading a card" size="sm" />
                <Panel className="flex flex-col gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <p><span className="font-bold text-neutral-900 dark:text-white">Big %</span> -- each team&apos;s model win probability. The red marker is the pick.</p>
                  <p><span className="font-bold text-neutral-900 dark:text-white">Market</span> -- Kalshi&apos;s price for the same pick.</p>
                  <p><span className="font-bold text-emerald-600 dark:text-emerald-400">Edge</span> -- model minus market, in points.</p>
                  <p><span className="font-bold text-neutral-900 dark:text-white">Margin</span> -- predicted home score minus away score.</p>
                </Panel>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
