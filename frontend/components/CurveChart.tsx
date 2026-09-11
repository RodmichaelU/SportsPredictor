import { CurvePoint, CurveTarget } from "@/lib/types";

const WIDTH = 680;
const HEIGHT = 320;
const PAD = { top: 16, right: 20, bottom: 40, left: 48 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

export default function CurveChart({
  curve,
  scatter,
  target,
  xLabel,
}: {
  curve: CurvePoint[];
  scatter: CurvePoint[];
  target: CurveTarget;
  xLabel: string;
}) {
  const allX = [...curve, ...scatter].map((p) => p.x);
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);

  let yMin: number;
  let yMax: number;
  if (target === "win") {
    yMin = 0;
    yMax = 1;
  } else {
    const allY = [...curve, ...scatter].map((p) => p.y);
    const dataMin = Math.min(...allY);
    const dataMax = Math.max(...allY);
    const pad = (dataMax - dataMin) * 0.08 || 1;
    yMin = dataMin - pad;
    yMax = dataMax + pad;
  }

  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * PLOT_W;
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin || 1)) * PLOT_H;

  const linePath = curve
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
    .join(" ");

  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = target === "win" ? [0, 0.25, 0.5, 0.75, 1] : niceTicks(yMin, yMax, 5);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${xLabel} vs ${target === "win" ? "win probability" : "predicted margin"}`}>
      {/* gridlines + y ticks */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={sy(t)}
            y2={sy(t)}
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={sy(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-neutral-400 text-[10px]"
          >
            {target === "win" ? `${Math.round(t * 100)}%` : t.toFixed(0)}
          </text>
        </g>
      ))}

      {/* x ticks */}
      {xTicks.map((t) => (
        <text
          key={t}
          x={sx(t)}
          y={HEIGHT - PAD.bottom + 16}
          textAnchor="middle"
          className="fill-neutral-400 text-[10px]"
        >
          {t.toFixed(0)}
        </text>
      ))}
      <text
        x={PAD.left + PLOT_W / 2}
        y={HEIGHT - 6}
        textAnchor="middle"
        className="fill-neutral-500 text-[11px] font-medium"
      >
        {xLabel}
      </text>

      {/* zero line for margin */}
      {target === "margin" && yMin < 0 && yMax > 0 && (
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={sy(0)}
          y2={sy(0)}
          className="stroke-neutral-300 dark:stroke-neutral-700"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}

      {/* real historical games */}
      {scatter.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.x)}
          cy={sy(Math.min(Math.max(p.y, yMin), yMax))}
          r={2.5}
          className="fill-neutral-400/50 dark:fill-neutral-500/50"
        />
      ))}

      {/* fitted model curve */}
      <path d={linePath} fill="none" className="stroke-sky-600" strokeWidth={2.5} />
    </svg>
  );
}
