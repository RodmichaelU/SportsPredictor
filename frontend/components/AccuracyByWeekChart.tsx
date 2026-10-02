import { WeeklyAccuracy } from "@/lib/types";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 24, right: 16, bottom: 36, left: 40 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

// A bar per week rather than one cumulative number -- shows whether the
// model is trending up, down, or just bouncing around week to week, which
// the single "Accuracy" figure elsewhere on this page can't. Fixed WIDTH
// (like every other chart in this app) rather than sizing the viewBox to
// the bar count: with "w-full" scaling to a wide container, a viewBox whose
// width grows with just a handful of bars has a much taller-than-wide
// aspect ratio, which stretched into an absurdly tall chart once rendered
// at full card width -- bars just get thinner as more weeks accumulate
// instead.
export default function AccuracyByWeekChart({ weeks }: { weeks: WeeklyAccuracy[] }) {
  if (weeks.length === 0) {
    return <p className="text-sm text-neutral-500">No completed weeks yet to chart.</p>;
  }

  const slot = PLOT_W / weeks.length;
  const barWidth = Math.min(56, slot * 0.6);
  const sy = (v: number) => PAD.top + (1 - v) * PLOT_H;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Accuracy by week">
      {Y_TICKS.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={sy(t)}
            y2={sy(t)}
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth={1}
          />
          <text x={PAD.left - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle" className="fill-neutral-400 text-[10px]">
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}

      {weeks.map((w, i) => {
        const centerX = PAD.left + slot * (i + 0.5);
        const barTop = sy(w.accuracy);
        const barH = PAD.top + PLOT_H - barTop;
        return (
          <g key={`${w.season}-${w.week}`}>
            <rect x={centerX - barWidth / 2} y={barTop} width={barWidth} height={barH} rx={4} className="fill-indigo-600" />
            <text x={centerX} y={barTop - 8} textAnchor="middle" className="fill-neutral-600 text-[11px] font-semibold dark:fill-neutral-300">
              {Math.round(w.accuracy * 100)}%
            </text>
            <text x={centerX} y={HEIGHT - PAD.bottom + 16} textAnchor="middle" className="fill-neutral-500 text-[11px] font-medium">
              Wk {w.week}
            </text>
            <text x={centerX} y={HEIGHT - PAD.bottom + 30} textAnchor="middle" className="fill-neutral-400 text-[10px]">
              n={w.sample_size}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
