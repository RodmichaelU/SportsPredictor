import { AccuracySummary } from "@/lib/types";
import { formatPercent } from "@/lib/format";

export default function AccuracyCard({ summary }: { summary: AccuracySummary }) {
  const supportingStats = [
    { label: "Log loss", value: summary.log_loss === null ? "—" : summary.log_loss.toFixed(3) },
    { label: "Brier score", value: summary.brier_score === null ? "—" : summary.brier_score.toFixed(3) },
    { label: "Calibration error", value: summary.ece === null ? "—" : summary.ece.toFixed(3) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {/* Accuracy is the headline number -- bigger, bolder, and colored,
          the way a sports dashboard leads with win % before advanced
          stats. */}
      <div className="col-span-2 flex flex-col justify-center rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40 sm:col-span-2">
        <div className="text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:text-indigo-400">
          Accuracy
        </div>
        <div className="mt-1 text-4xl font-black tabular-nums text-indigo-700 dark:text-indigo-300">
          {summary.accuracy === null ? "—" : formatPercent(summary.accuracy)}
        </div>
      </div>

      {supportingStats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="text-xs text-neutral-500">{stat.label}</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{stat.value}</div>
        </div>
      ))}

      <div className="col-span-2 self-center text-xs text-neutral-500 sm:col-span-5">
        Based on {summary.sample_size} completed games.
      </div>
    </div>
  );
}
