export default function ProbabilityDuel({
  homeTeam,
  awayTeam,
  winProbability, // home team's win probability, 0-1
}: {
  homeTeam: string;
  awayTeam: string;
  winProbability: number;
}) {
  const homePct = Math.round(winProbability * 100);
  const awayPct = 100 - homePct;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm font-semibold">
        <span>{awayTeam}</span>
        <span>{homeTeam}</span>
      </div>
      <div className="flex h-8 overflow-hidden rounded-full border border-neutral-200 dark:border-neutral-800">
        <div
          className="flex items-center justify-start bg-amber-500 pl-3 text-xs font-semibold text-white transition-all"
          style={{ width: `${awayPct}%` }}
        >
          {awayPct >= 12 && `${awayPct}%`}
        </div>
        <div
          className="flex items-center justify-end bg-sky-600 pr-3 text-xs font-semibold text-white transition-all"
          style={{ width: `${homePct}%` }}
        >
          {homePct >= 12 && `${homePct}%`}
        </div>
      </div>
      <div className="text-center text-xs text-neutral-500">
        Win probability, as of when this prediction was frozen
      </div>
    </div>
  );
}
