import { formatPercent } from "@/lib/format";

export default function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-neutral-900 dark:bg-white"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
        {formatPercent(confidence)}
      </span>
    </div>
  );
}
