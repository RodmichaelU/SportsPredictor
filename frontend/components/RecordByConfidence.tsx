import { Result } from "@/lib/types";
import { formatPercent, pickConfidence } from "@/lib/format";

// Hit rate by how confident the model was in its pick -- complements the
// calibration chart (which works in home-win probability) with the
// question people actually ask: "when it's 80% sure, how often is it right?"
export default function RecordByConfidence({ results }: { results: Result[] }) {
  const bands = [50, 60, 70, 80, 90].map((lo) => {
    const inBand = results.filter((r) => {
      const c = pickConfidence(r) * 100;
      return c >= lo && (lo === 90 ? c <= 100 : c < lo + 10);
    });
    const hits = inBand.filter((r) => r.hit).length;
    return { lo, games: inBand.length, rate: inBand.length ? hits / inBand.length : null };
  });

  return (
    <div className="flex flex-col gap-3">
      {bands.map((b) => (
        <div key={b.lo} className="flex items-center gap-3 text-sm">
          <span className="w-16 shrink-0 font-semibold text-neutral-500 tabular-nums">
            {b.lo}
            {b.lo === 90 ? "+" : `–${b.lo + 9}`}%
          </span>
          <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-neutral-100 dark:bg-white/5">
            {b.rate !== null && <div className="h-full bg-emerald-600" style={{ width: `${b.rate * 100}%` }} />}
            {/* Tick where the band's own confidence says the hit rate should land. */}
            <div className="absolute inset-y-0 w-0.5 bg-neutral-900 dark:bg-white" style={{ left: `${b.lo + 5}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right tabular-nums">
            <span className="font-bold">{b.rate === null ? "—" : formatPercent(b.rate)}</span>
            <span className="text-neutral-400"> of {b.games}</span>
          </span>
        </div>
      ))}
      <p className="text-xs text-neutral-500">
        Green is how often picks in each confidence band were right. The tick marks where it should land
        if the stated confidence is honest.
      </p>
    </div>
  );
}
