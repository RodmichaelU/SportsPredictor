import { AccuracySummary } from "@/lib/types";
import { formatPercent } from "@/lib/format";

export default function AccuracyCard({ summary }: { summary: AccuracySummary }) {
  const stats = [
    { label: "Accuracy", value: formatPercent(summary.accuracy) },
    { label: "Log loss", value: summary.log_loss.toFixed(3) },
    { label: "Brier score", value: summary.brier_score.toFixed(3) },
    { label: "Calibration error", value: summary.ece.toFixed(3) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <div className="text-xs text-neutral-500">{stat.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</div>
        </div>
      ))}
      <div className="col-span-2 self-center text-xs text-neutral-500 sm:col-span-4">
        Based on {summary.sample_size} completed games.
      </div>
    </div>
  );
}
