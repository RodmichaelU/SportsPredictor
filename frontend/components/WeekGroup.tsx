import { Suspense } from "react";
import WeekGate from "./WeekGate";

// One week's block on the Results page, hidden when the week filter (?week=,
// set by WeekFilter) picks a different week. The page is pre-built with every
// week, so filtering happens in the browser; the Suspense fallback is the
// unfiltered block, so the static HTML (and no-JS visitors) show all weeks.
export default function WeekGroup({ week, children }: { week: number; children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <WeekGate week={week}>{children}</WeekGate>
    </Suspense>
  );
}
