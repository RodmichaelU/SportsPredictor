import { getAccuracy, getAccuracyByWeek, getCalibration, getResults, getSports } from "@/lib/api";
import { Result } from "@/lib/types";
import { formatPercent, pickConfidence } from "@/lib/format";
import AccuracyByWeekChart from "@/components/AccuracyByWeekChart";
import BiggestUpsets from "@/components/BiggestUpsets";
import CalibrationChart from "@/components/CalibrationChart";
import PageBand, { BandStat } from "@/components/PageBand";
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

  const [results, accuracy, calibration, accuracyByWeek] = await Promise.all([
    getResults(sport),
    getAccuracy(sport),
    getCalibration(sport),
    getAccuracyByWeek(sport),
  ]);

  const weeks = [...new Set(results.map((r) => r.week))].sort((a, b) => b - a);
  const selectedWeek = searchParams.week ? Number(searchParams.week) : null;
  const visibleResults = selectedWeek ? results.filter((r) => r.week === selectedWeek) : results;

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

  // Hit rate by how confident the model was in its pick -- complements the
  // calibration chart (which works in home-win probability) with the
  // question people actually ask: "when it's 80% sure, how often is it right?"
  const confidenceBands = [50, 60, 70, 80, 90].map((lo) => {
    const inBand = results.filter((r) => {
      const c = pickConfidence(r) * 100;
      return c >= lo && (lo === 90 ? c <= 100 : c < lo + 10);
    });
    const hits = inBand.filter((r) => r.hit).length;
    return { lo, games: inBand.length, rate: inBand.length ? hits / inBand.length : null };
  });

  const stat = (v: number | null) => (v === null ? "—" : v.toFixed(3));

  return (
    <div className="flex flex-col gap-10">
      <PageBand
        eyebrow={sportInfo?.name ?? sport.toUpperCase()}
        title="Results"
        description={
          <>
            Predicted vs. actual, scored against the prediction frozen before kickoff. Based on{" "}
            {accuracy.sample_size} completed games.
          </>
        }
        aside={
          <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
            <div>
              <div className="display text-7xl tabular-nums sm:text-8xl">
                {accuracy.accuracy === null ? "—" : Math.round(accuracy.accuracy * 100)}
                <span className="text-brand-500">%</span>
              </div>
              <div className="eyebrow text-[11px] text-neutral-400">Accuracy</div>
            </div>
            <BandStat value={stat(accuracy.log_loss)} label="Log loss" />
            <BandStat value={stat(accuracy.brier_score)} label="Brier score" />
            <BandStat value={stat(accuracy.ece)} label="Calibration error" />
          </div>
        }
      />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-10">
          {accuracyByWeek.weeks.length >= 2 && (
            <Reveal>
              <SectionHeader title="Accuracy by week" />
              <Panel>
                <p className="mb-3 max-w-2xl text-sm text-neutral-500">
                  The same hit rate as the headline number above, broken out week by week -- whether the
                  model is trending up, down, or just bouncing around isn&apos;t visible in one cumulative
                  figure.
                </p>
                <AccuracyByWeekChart weeks={accuracyByWeek.weeks} />
              </Panel>
            </Reveal>
          )}

          <div className="flex items-center justify-between gap-4">
            <h2 className="display text-3xl">Every graded pick</h2>
            <WeekFilter weeks={weeks} />
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-neutral-500">
              {results.length === 0 ? "No completed games for this sport yet." : "No completed games for that week."}
            </p>
          ) : (
            groups.map((g) => {
              const hits = g.games.filter((r) => r.hit).length;
              return (
                <Reveal key={g.key}>
                  <SectionHeader
                    eyebrow={`${hits}–${g.games.length - hits} · ${formatPercent(hits / g.games.length)}`}
                    title={g.title}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {g.games.map((r) => (
                      <ResultCard key={r.game_id} result={r} sport={sport} />
                    ))}
                  </div>
                </Reveal>
              );
            })
          )}
        </div>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-28">
          <div>
            <SectionHeader title="Record by confidence" size="sm" />
            <Panel className="flex flex-col gap-2.5">
              {confidenceBands.map((b) => (
                <div key={b.lo} className="flex items-center gap-3 text-xs">
                  <span className="w-14 shrink-0 font-semibold text-neutral-500 tabular-nums">
                    {b.lo}{b.lo === 90 ? "+" : `–${b.lo + 9}`}%
                  </span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-neutral-100 dark:bg-white/5">
                    {b.rate !== null && <div className="h-full bg-emerald-600" style={{ width: `${b.rate * 100}%` }} />}
                    {/* Tick where the band's own confidence says the hit rate should land. */}
                    <div className="absolute inset-y-0 w-px bg-neutral-900 dark:bg-white" style={{ left: `${b.lo + 5}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums">
                    <span className="font-bold">{b.rate === null ? "—" : formatPercent(b.rate)}</span>
                    <span className="text-neutral-400"> /{b.games}</span>
                  </span>
                </div>
              ))}
              <p className="mt-1 text-[11px] text-neutral-500">
                Hit rate when the model was that confident. The tick marks where it should land if the
                confidence is honest.
              </p>
            </Panel>
          </div>

          {calibration.sample_size >= 10 && (
            <div>
              <SectionHeader title="Is the confidence trustworthy?" size="sm" />
              <Panel>
                <p className="mb-3 text-xs text-neutral-500">
                  Every completed game grouped by how confident the model was, compared to how often the
                  home team actually won in that group. Dots on the dashed line mean the model&apos;s stated
                  confidence matches reality. Dot size shows how many games are in that group.
                </p>
                <CalibrationChart bins={calibration.bins} />
              </Panel>
            </div>
          )}

          <BiggestUpsets results={visibleResults} sport={sport} />
        </aside>
      </div>
    </div>
  );
}
