"use client";

import { Sport } from "@/lib/types";
import LeagueNav from "./LeagueNav";
import NavTabs from "./NavTabs";

export default function HeaderControls({ sports }: { sports: Sport[] }) {
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <LeagueNav sports={sports} />
      <NavTabs />
    </div>
  );
}
