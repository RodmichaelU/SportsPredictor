"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// URL-driven, like the sport/league nav -- so a filtered view is a real,
// shareable/bookmarkable link rather than component-local state that resets
// on navigation.
export default function WeekFilter({ weeks }: { weeks: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("week") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams);
    if (e.target.value) {
      params.set("week", e.target.value);
    } else {
      params.delete("week");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  if (weeks.length <= 1) return null;

  return (
    <select
      value={selected}
      onChange={onChange}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
    >
      <option value="">All weeks</option>
      {weeks.map((w) => (
        <option key={w} value={w}>
          Week {w}
        </option>
      ))}
    </select>
  );
}
