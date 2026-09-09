import { FeatureWeight } from "@/lib/types";

export default function WeightBar({ weight, maxAbsWeight }: { weight: FeatureWeight; maxAbsWeight: number }) {
  const pct = maxAbsWeight > 0 ? Math.round((Math.abs(weight.weight) / maxAbsWeight) * 100) : 0;
  const positive = weight.weight >= 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-56 shrink-0 text-sm text-neutral-700 dark:text-neutral-300">{weight.label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
        <div
          className={`h-full rounded-full ${positive ? "bg-sky-600" : "bg-amber-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`w-16 shrink-0 text-right text-sm tabular-nums ${
          positive ? "text-sky-700 dark:text-sky-400" : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {positive ? "+" : ""}
        {weight.weight.toFixed(3)}
      </div>
    </div>
  );
}
