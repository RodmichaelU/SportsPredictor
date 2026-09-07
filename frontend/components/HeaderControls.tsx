"use client";

import { Sport } from "@/lib/types";
import SportSelector from "./SportSelector";
import NavTabs from "./NavTabs";

export default function HeaderControls({ sports }: { sports: Sport[] }) {
  return (
    <div className="flex items-center gap-4">
      <SportSelector sports={sports} />
      <NavTabs />
    </div>
  );
}
