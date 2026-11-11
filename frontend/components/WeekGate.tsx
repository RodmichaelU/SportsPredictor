"use client";

import { useSearchParams } from "next/navigation";

// Client half of WeekGroup: reads ?week= and shows its children only for the
// selected week (or every week when no filter is set).
export default function WeekGate({ week, children }: { week: number; children: React.ReactNode }) {
  const selected = useSearchParams().get("week");
  if (selected && Number(selected) !== week) return null;
  return <>{children}</>;
}
