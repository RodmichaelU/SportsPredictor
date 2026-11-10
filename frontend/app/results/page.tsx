import Link from "next/link";
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
import Reveal from "@/components/Reveal";

export default async function ResultsPage(props: PageProps<"/results">) {
  const searchParams = await props.searchParams;
  const sports = await getSports();
  const sport = (searchParams.sport as string) ?? sports[0]?.id ?? "cfb";
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
  const selectedWeek = searchParams.week ? Number(searchParams.week) : null;
  const visibleResults = selectedWeek ? results.filter((r) => r.week === selectedWeek) : results;
  const hits = results.filter((r) => r.hit).length;

  // Newest week first, each with its own record for the section header.
  const multiSeason = new Set(visibleResults.map((r) => r.season)).size > 1;
  const groups: { key: string; title: string; games: Result[] }[] = [];
  for (const r of [...visibleResults].sort((a, b) => b.game_date.localeCompare(a.game_date))) {
    const key = `${r.season}-${r.week}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, title: multiSeason ? `${r.season} · Week ${r.week}` : `Week ${r.week}`, games: [] };
      groups.push(group);
    }
    group.games.push(r);
  }

  return (
    <div className="flex flex-col gap-16">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="Results"
        description={
          <>
            Every pick, scored against the prediction frozen before kickoff. Wondering whether the
            confidence numbers hold up?{" "}
            <Link href={`/model?sport=${sport}#honesty`} className="underline decoration-white/30 underline-offset-2 hover:text-brand-400">
              See the calibration checks
            </Link>
            .
          </>
        }
        aside={
          <div className="text-right">
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
        <Reveal className="grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
          {accuracyByWeek.weeks.length >= 2 && (
            <section>
              <SectionHeader title="Week by week" />
              <Panel className="p-6">
                <AccuracyByWeekChart weeks={accuracyByWeek.weeks} />
              </Panel>
            </section>
          )}
          <BiggestUpsets results={visibleResults} sport={sport} />
        </Reveal>
      )}

      <section className="flex flex-col gap-12">
        <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-10 dark:border-white/10">
          <h2 className="display text-4xl">Every graded pick</h2>
          <WeekFilter weeks={weeks} />
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {results.length === 0 ? "No completed games for this sport yet." : "No completed games for that week."}
          </p>
        ) : (
          groups.map((g) => {
            const weekHits = g.games.filter((r) => r.hit).length;
            return (
              <Reveal as="section" key={g.key}>
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
            );
          })
        )}
      </section>
    </div>
  );
}
