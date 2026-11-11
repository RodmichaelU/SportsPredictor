// Browser-side data access for the static site: fetches the JSON files
// src/export_static.py publishes under /data. Only for things fetched
// interactively (model curves as the user changes the explorer's inputs);
// everything else is baked into the pages at build time via lib/api.ts.

import { CurveTarget, ModelCurve } from "./types";

// Set when the site is served from a subpath (GitHub Pages: /SportsPredictor).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function fetchModelCurve(sport: string, feature: string, target: CurveTarget): Promise<ModelCurve> {
  const res = await fetch(`${BASE_PATH}/data/${sport}/curves/${feature}__${target}.json`);
  if (!res.ok) throw new Error(`No curve for ${sport}/${feature}/${target}`);
  return res.json();
}
