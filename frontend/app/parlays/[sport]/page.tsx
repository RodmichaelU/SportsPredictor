import type { Metadata } from "next";
import { getSports } from "@/lib/api";
import ParlaysView from "../ParlaysView";

export const metadata: Metadata = {
  title: "Parlay Picker",
  description: "Model-built parlays at three risk tiers, priced by the prediction market.",
};

// Pre-built for each live league: /parlays/cfb/, /parlays/nfl/, ...
export async function generateStaticParams() {
  return (await getSports()).filter((s) => s.status === "live").map((s) => ({ sport: s.id }));
}
export const dynamicParams = false;

export default async function LeagueParlaysPage(props: PageProps<"/parlays/[sport]">) {
  const { sport } = await props.params;
  return <ParlaysView selected={sport} />;
}
