import Link from "next/link";
import { Suspense } from "react";
import { getAccuracy, getAccuracyByWeek, getResults, getSports } from "@/lib/api";
import { Result } from "@/lib/types";
import { formatPercent } from "@/lib/format";
import AccuracyByWeekChart from "@/components/AccuracyByWeekChart";
import BiggestUpsets from "@/components/BiggestUpsets";
import PageBand from "@/components/PageBand";
import ResultCard from "@/components/ResultCard";
import ComingSoon from "@/components/ComingSoon";
import SectionHeader, { Panel } from "@/components/SectionHeader";
import WeekFilter from "@/components/WeekFilter";
import WeekGroup from "@/components/WeekGroup";
import { modelPath } from "@/lib/routes";
import Reveal from "@/components/Reveal";

// Pre-built once per league (static export): /results/cfb/, /results/nfl/, ...
export async function generateStaticParams() {
  return (await getSports()).map((s) => ({ sport: s.id }));
}
export const dynamicParams = false;

export default async function ResultsPage(props: PageProps<"/results/[sport]">) {
  const { sport } = await props.params;
  const sports = await getSports();
  const sportInfo = sports.find((s) => s.id === sport);

  if (sportInfo?.status === "coming_soon") {
    return <ComingSoon sport={sportInfo} />;
  }

  const [results, accuracy, accuracyByWeek] = await Promise.all([
    getResults(sport),
    getAccuracy(sport),
    getAccuracyByWeek(sport),
  ]);

  const weeks = [...new Set(results.map((r) => r.week))].sort((a, b) => b - a);
  const hits = results.filter((r) => r.hit).length;

  // Newest week first, each with its own record for the section header.
  const multiSeason = new Set(results.map((r) => r.season)).size > 1;
  const groups: { key: string; week: number; title: string; games: Result[] }[] = [];
  for (const r of [...results].sort((a, b) => b.game_date.localeCompare(a.game_date))) {
    const key = `${r.season}-${r.week}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, week: r.week, title: multiSeason ? `${r.season} · Week ${r.week}` : `Week ${r.week}`, games: [] };
      groups.push(group);
    }
    group.games.push(r);
  }

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="Results"
        description={
          <>
            Every pick, scored against the prediction frozen before kickoff. Wondering whether the
            confidence numbers hold up?{" "}
            <Link href={`${modelPath(sport)}#honesty`} className="underline decoration-white/30 underline-offset-2 hover:text-brand-400">
              See the calibration checks
            </Link>
            .
          </>
        }
        aside={
          <div className="sm:text-right">
            <div className="display text-8xl tabular-nums sm:text-9xl">
              {accuracy.accuracy === null ? "—" : Math.round(accuracy.accuracy * 100)}
              <span className="text-brand-500">%</span>
            </div>
            <div className="eyebrow text-xs text-neutral-400">
              {hits}–{results.length - hits} · accuracy
            </div>
          </div>
        }
      />

      {(accuracyByWeek.weeks.length >= 2 || results.some((r) => !r.hit)) && (
        <Reveal className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
          {accuracyByWeek.weeks.length >= 2 && (
            <section>
              <SectionHeader title="Week by week" />
              <Panel className="p-4 sm:p-6">
                <AccuracyByWeekChart weeks={accuracyByWeek.weeks} />
              </Panel>
            </section>
          )}
          <BiggestUpsets results={results} sport={sport} />
        </Reveal>
      )}

      <section className="flex flex-col gap-12">
        <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-10 dark:border-white/10">
          <h2 className="display text-3xl sm:text-4xl">Every graded pick</h2>
          <Suspense fallback={null}>
            <WeekFilter weeks={weeks} />
          </Suspense>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No completed games for this sport yet.
          </p>
        ) : (
          groups.map((g) => {
            const weekHits = g.games.filter((r) => r.hit).length;
            return (
              <WeekGroup key={g.key} week={g.week}>
                <Reveal as="section">
                  <SectionHeader
                    title={g.title}
                    eyebrow={`${weekHits}–${g.games.length - weekHits} · ${formatPercent(weekHits / g.games.length)}`}
                  />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {g.games.map((r) => (
                      <ResultCard key={r.game_id} result={r} sport={sport} />
                    ))}
                  </div>
                </Reveal>
              </WeekGroup>
            );
          })
        )}
      </section>
    </div>
  );
}
