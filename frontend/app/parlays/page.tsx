import type { Metadata } from "next";
import ParlaysView from "./ParlaysView";

export const metadata: Metadata = {
  title: "Parlay Picker",
  description: "Model-built parlays at three risk tiers, priced by the prediction market.",
};

export default function ParlaysPage() {
  return <ParlaysView selected={null} />;
}
