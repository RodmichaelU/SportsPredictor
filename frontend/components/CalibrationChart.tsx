import { CalibrationBin } from "@/lib/types";

const WIDTH = 400;
const HEIGHT = 400;
const PAD = { top: 16, right: 16, bottom: 40, left: 48 };
const PLOT = WIDTH - PAD.left - PAD.right;

const TICKS = [0, 0.25, 0.5, 0.75, 1];

// A reliability diagram: each dot is one probability bucket, plotting the
// model's average prediction in that bucket (x) against how often home
// teams actually won in it (y). Dots on the dashed diagonal mean "when the
// model said 70%, it was right about 70% of the time" -- the same read as
// the Calibration error number elsewhere, made visual. Dot size scales with
// how many games are in that bucket, so a bucket's weight in the overall
// score is visible too.
export default function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  if (bins.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough completed games yet to plot calibration.</p>;
  }

  const s = (v: number) => PAD.left + v * PLOT;
  const maxCount = Math.max(...bins.map((b) => b.count));
  const radius = (count: number) => 4 + (count / maxCount) * 8;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto w-full max-w-sm"
      role="img"
      aria-label="Reliability diagram: predicted vs. actual home win rate"
    >
      {TICKS.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={s(1 - t)}
            y2={s(1 - t)}
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth={1}
          />
          <line
            x1={s(t)}
            x2={s(t)}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth={1}
          />
          <text x={PAD.left - 8} y={s(1 - t)} textAnchor="end" dominantBaseline="middle" className="fill-neutral-400 text-[10px]">
            {Math.round(t * 100)}%
          </text>
          <text x={s(t)} y={HEIGHT - PAD.bottom + 16} textAnchor="middle" className="fill-neutral-400 text-[10px]">
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}

      <text x={PAD.left + PLOT / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-neutral-500 text-[11px] font-medium">
        Predicted home win probability
      </text>
      <text
        x={14}
        y={PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90 14 ${PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2})`}
        className="fill-neutral-500 text-[11px] font-medium"
      >
        Actual home win rate
      </text>

      {/* perfect calibration */}
      <line
        x1={s(0)}
        y1={s(1)}
        x2={s(1)}
        y2={s(0)}
        className="stroke-neutral-300 dark:stroke-neutral-600"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />

      <polyline
        points={bins.map((b) => `${s(b.predicted_mean)},${s(1 - b.actual_rate)}`).join(" ")}
        fill="none"
        className="stroke-sky-600"
        strokeWidth={2}
      />
      {bins.map((b) => (
        <circle
          key={b.bin_start}
          cx={s(b.predicted_mean)}
          cy={s(1 - b.actual_rate)}
          r={radius(b.count)}
          className="fill-sky-600/70 stroke-white dark:stroke-neutral-900"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
