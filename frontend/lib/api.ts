// Server-side data access for the static site. Reads the JSON files
// src/export_static.py writes to public/data/ (regenerated on every refresh),
// so pages are built from the same responses the API would return -- field
// names match lib/types.ts exactly. Server components only: this reads the
// filesystem at build time. Browser code uses lib/clientData.ts instead.
//
// With no export present (fresh clone, UI work), falls back to mock data.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MOCK_ACCURACY, MOCK_ACCURACY_BY_WEEK, MOCK_CALIBRATION, MOCK_EXPLANATION, mockModelCurve, MOCK_MODEL_WEIGHTS, MOCK_PREDICTIONS, MOCK_RESULTS, MOCK_SPORTS, MOCK_STANDINGS, mockTeamDetail, MOCK_TEAMS } from "./mockData";
import { AccuracyByWeek, AccuracySummary, Calibration, CurveTarget, Explanation, ModelCurve, ModelWeights, Parlays, Prediction, Result, Sport, Standings, TeamDetail } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const HAS_DATA = existsSync(path.join(DATA_DIR, "meta.json"));

export const isLiveData = HAS_DATA;

export interface SiteMeta {
  refreshed_at: string; // ISO timestamp: when the data (and its market prices) was exported
  refresh_interval_hours: number;
}

const cache = new Map<string, Promise<unknown>>();

// Memoized per build: hundreds of pages read the same few files.
function readJson<T>(rel: string): Promise<T> {
  if (!cache.has(rel)) {
    cache.set(rel, readFile(path.join(DATA_DIR, rel), "utf8").then((text) => JSON.parse(text)));
  }
  return cache.get(rel) as Promise<T>;
}

export async function getMeta(): Promise<SiteMeta | null> {
  if (!HAS_DATA) return null;
  return readJson<SiteMeta>("meta.json");
}

export async function getSports(): Promise<Sport[]> {
  if (!HAS_DATA) return MOCK_SPORTS;
  return readJson<Sport[]>("sports.json");
}

export async function getPredictions(sport: string, week?: number): Promise<Prediction[]> {
  const all = HAS_DATA ? await readJson<Prediction[]>(`${sport}/predictions.json`) : MOCK_PREDICTIONS.filter((p) => p.sport === sport);
  return week === undefined ? all : all.filter((p) => p.week === week);
}

export async function getResults(sport: string, week?: number): Promise<Result[]> {
  const all = HAS_DATA ? await readJson<Result[]>(`${sport}/results.json`) : MOCK_RESULTS.filter((r) => r.sport === sport);
  return week === undefined ? all : all.filter((r) => r.week === week);
}

export async function getAccuracy(sport: string): Promise<AccuracySummary> {
  if (!HAS_DATA) return { ...MOCK_ACCURACY, sport };
  return readJson<AccuracySummary>(`${sport}/accuracy.json`);
}

export async function getModelWeights(sport: string): Promise<ModelWeights> {
  if (!HAS_DATA) return { ...MOCK_MODEL_WEIGHTS, sport };
  return readJson<ModelWeights>(`${sport}/model-weights.json`);
}

export async function getExplanation(sport: string, gameId: string): Promise<Explanation> {
  if (!HAS_DATA) {
    const game = [...MOCK_PREDICTIONS, ...MOCK_RESULTS].find((p) => p.game_id === gameId);
    return {
      ...MOCK_EXPLANATION,
      sport,
      game_id: gameId,
      home_team: game?.home_team ?? MOCK_EXPLANATION.home_team,
      away_team: game?.away_team ?? MOCK_EXPLANATION.away_team,
      predicted_winner: game?.predicted_winner ?? MOCK_EXPLANATION.predicted_winner,
      win_probability: game?.win_probability ?? MOCK_EXPLANATION.win_probability,
    };
  }
  return readJson<Explanation>(`${sport}/explain/${gameId}.json`);
}

// Every game with an explanation page, for generateStaticParams: the
// exporter lists exactly the ones it could write.
export async function getGameIds(sport: string): Promise<string[]> {
  if (!HAS_DATA) {
    return [...new Set([...MOCK_PREDICTIONS, ...MOCK_RESULTS].filter((g) => g.sport === sport).map((g) => g.game_id))];
  }
  return readJson<string[]>(`${sport}/explained.json`);
}

export async function getModelCurve(sport: string, feature: string, target: CurveTarget): Promise<ModelCurve> {
  if (!HAS_DATA) return mockModelCurve(sport, feature, target);
  return readJson<ModelCurve>(`${sport}/curves/${feature}__${target}.json`);
}

export async function getCalibration(sport: string): Promise<Calibration> {
  if (!HAS_DATA) return { ...MOCK_CALIBRATION, sport };
  return readJson<Calibration>(`${sport}/calibration.json`);
}

// team name -> URL slug ("Miami (OH)" -> "miami-oh"), as chosen by the exporter.
export async function getTeamSlugs(sport: string): Promise<Record<string, string>> {
  if (!HAS_DATA) {
    return Object.fromEntries(MOCK_TEAMS.map((t) => [t, t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")]));
  }
  const teams = await readJson<{ team: string; slug: string }[]>(`${sport}/teams.json`);
  return Object.fromEntries(teams.map((t) => [t.team, t.slug]));
}

export async function getTeams(sport: string): Promise<string[]> {
  return Object.keys(await getTeamSlugs(sport)).sort();
}

export async function getTeamBySlug(sport: string, slug: string): Promise<TeamDetail> {
  if (!HAS_DATA) {
    const slugs = await getTeamSlugs(sport);
    const team = Object.keys(slugs).find((t) => slugs[t] === slug) ?? slug;
    return mockTeamDetail(sport, team);
  }
  return readJson<TeamDetail>(`${sport}/team/${slug}.json`);
}

// team name/code -> logo URL. Read once per build and shared by every
// TeamBadge on every page.
export async function getTeamLogos(sport: string): Promise<Record<string, string>> {
  if (!HAS_DATA) return {};
  return readJson<Record<string, string>>(`${sport}/logos.json`).catch(() => ({}));
}

export async function getStandings(sport: string): Promise<Standings> {
  if (!HAS_DATA) return { ...MOCK_STANDINGS, sport };
  return readJson<Standings>(`${sport}/standings.json`);
}

export async function getAccuracyByWeek(sport: string): Promise<AccuracyByWeek> {
  if (!HAS_DATA) return { ...MOCK_ACCURACY_BY_WEEK, sport };
  return readJson<AccuracyByWeek>(`${sport}/accuracy-by-week.json`);
}

// Parlays at three risk tiers for one sport, or pooled across every live
// sport. Needs real market prices, so there's no mock version.
export async function getParlays(sport?: string): Promise<Parlays | null> {
  if (!HAS_DATA) return null;
  return readJson<Parlays>(sport ? `${sport}/parlays.json` : "parlays/all.json");
}
