import { MOCK_ACCURACY, MOCK_EXPLANATION, mockModelCurve, MOCK_MODEL_WEIGHTS, MOCK_PREDICTIONS, MOCK_RESULTS, MOCK_SPORTS } from "./mockData";
import { AccuracySummary, CurveTarget, Explanation, ModelCurve, ModelWeights, Prediction, Result, Sport } from "./types";

// With NEXT_PUBLIC_API_URL unset, falls back to mock data (useful for UI
// work without the backend running). Set it to point at api/main.py
// (Phase 6) for real predictions -- response shapes already match exactly.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API request failed (${res.status}): ${path}`);
  }
  return res.json();
}

export async function getSports(): Promise<Sport[]> {
  if (!API_BASE_URL) return MOCK_SPORTS;
  return fetchJson<Sport[]>("/sports");
}

export async function getPredictions(sport: string, week?: number): Promise<Prediction[]> {
  if (!API_BASE_URL) {
    return MOCK_PREDICTIONS.filter(
      (p) => p.sport === sport && (week === undefined || p.week === week)
    );
  }
  const params = new URLSearchParams({ sport });
  if (week !== undefined) params.set("week", String(week));
  return fetchJson<Prediction[]>(`/predictions?${params}`);
}

export async function getResults(sport: string, week?: number): Promise<Result[]> {
  if (!API_BASE_URL) {
    return MOCK_RESULTS.filter(
      (r) => r.sport === sport && (week === undefined || r.week === week)
    );
  }
  const params = new URLSearchParams({ sport });
  if (week !== undefined) params.set("week", String(week));
  return fetchJson<Result[]>(`/results?${params}`);
}

export async function getAccuracy(sport: string): Promise<AccuracySummary> {
  if (!API_BASE_URL) return { ...MOCK_ACCURACY, sport };
  return fetchJson<AccuracySummary>(`/accuracy?sport=${sport}`);
}

export async function getModelWeights(sport: string): Promise<ModelWeights> {
  if (!API_BASE_URL) return { ...MOCK_MODEL_WEIGHTS, sport };
  return fetchJson<ModelWeights>(`/model-weights?sport=${sport}`);
}

export async function getExplanation(sport: string, gameId: string): Promise<Explanation> {
  if (!API_BASE_URL) {
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
  return fetchJson<Explanation>(`/explain?sport=${sport}&game_id=${encodeURIComponent(gameId)}`);
}

export async function getModelCurve(sport: string, feature: string, target: CurveTarget): Promise<ModelCurve> {
  if (!API_BASE_URL) return mockModelCurve(sport, feature, target);
  return fetchJson<ModelCurve>(`/model-curve?sport=${sport}&feature=${feature}&target=${target}`);
}

export const isLiveApi = Boolean(API_BASE_URL);
