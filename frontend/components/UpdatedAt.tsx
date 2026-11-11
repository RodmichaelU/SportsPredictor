"use client";

import { useEffect, useState } from "react";

function relative(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min ago` : `${hours} hr ago`;
}

// When the site's data (and its market prices) was last refreshed. The site
// is rebuilt every few hours rather than live, so this tells visitors how
// current the odds are. The "ago" part is computed in the visitor's browser
// and ticks every minute, so it stays accurate however long a page sits open.
export default function UpdatedAt({
  iso,
  intervalHours,
  variant = "inline",
}: {
  iso: string;
  intervalHours?: number;
  variant?: "inline" | "pill";
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const at = new Date(iso);
  // Rendered only after mount: server and browser clocks/time zones differ.
  const time = now === null ? null : at.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  // Overdue by more than one interval: say so rather than imply freshness.
  const stale = now !== null && intervalHours !== undefined && now - at.getTime() > intervalHours * 2 * 3600_000;

  const body = (
    <>
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${stale ? "bg-amber-500" : "bg-emerald-500"}`} />
      <span>
        Odds &amp; results updated{" "}
        {time ? (
          <>
            <span className="font-semibold">{time}</span> · {relative(now! - at.getTime())}
          </>
        ) : (
          "recently"
        )}
        {intervalHours !== undefined && <span className="opacity-70"> · refreshes every {intervalHours} hours</span>}
      </span>
    </>
  );

  if (variant === "pill") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-neutral-200">{body}</span>
    );
  }
  return <span className="inline-flex items-center gap-2 text-xs">{body}</span>;
}
