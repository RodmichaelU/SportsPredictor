"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sport } from "@/lib/types";

export default function SportSelector({ sports }: { sports: Sport[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("sport") ?? sports[0]?.id ?? "";

  function handleChange(sportId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sport", sportId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">Sport</span>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium dark:border-neutral-700 dark:bg-neutral-900"
      >
        {sports.map((sport) => (
          <option key={sport.id} value={sport.id}>
            {sport.name}
          </option>
        ))}
      </select>
    </label>
  );
}
