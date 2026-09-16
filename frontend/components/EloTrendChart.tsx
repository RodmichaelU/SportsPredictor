import { EloHistoryPoint } from "@/lib/types";

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

// A simple line: this team's Elo rating after each game this season, game by
// game (not calendar time -- a bye week shouldn't visually compress the
// chart). Elo is the from-scratch baseline every other model in this app has
// to beat, so it doubles as "is this team trending up or down" in a way a
// single win-loss record doesn't show.
export default function EloTrendChart({ history, currentRating }: { history: EloHistoryPoint[]; currentRating: number | null }) {
  if (history.length === 0 || currentRating === null) {
    return <p className="text-sm text-neutral-500">Not enough games yet this season to plot a trend.</p>;
  }

  const points = [{ rating: history[0].rating_before, opponent: "Season start" }, ...history.map((h) => ({ rating: h.rating_after, opponent: h.opponent }))];

  const ratings = points.map((p) => p.rating);
  const yMin = Math.min(...ratings) - 20;
  const yMax = Math.max(...ratings) + 20;

  const sx = (i: number) => PAD.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * PLOT_W);
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin || 1)) * PLOT_H;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(i).toFixed(1)} ${sy(p.rating).toFixed(1)}`).join(" ");
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Elo rating trend this season">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={sy(t)} y2={sy(t)} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth={1} />
          <text x={PAD.left - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle" className="fill-neutral-400 text-[10px]">
            {Math.round(t)}
          </text>
        </g>
      ))}

      <path d={path} fill="none" className="stroke-indigo-600" strokeWidth={2.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(p.rating)} r={i === points.length - 1 ? 4.5 : 3} className="fill-indigo-600 stroke-white dark:stroke-neutral-900" strokeWidth={1.5} />
          <text x={sx(i)} y={HEIGHT - PAD.bottom + 14} textAnchor="middle" className="fill-neutral-400 text-[9px]">
            {i === 0 ? "Start" : `vs ${p.opponent}`.slice(0, 10)}
          </text>
        </g>
      ))}
    </svg>
  );
}
