import { MOCK_ACCURACY, MOCK_PREDICTIONS, MOCK_RESULTS, MOCK_SPORTS } from "./mockData";
import { AccuracySummary, Prediction, Result, Sport } from "./types";

// Once api/main.py (Phase 6) is live, swap each function body below for a
// fetch(`${API_BASE_URL}/...`) call. Signatures and return shapes already
// match the planned endpoint contract, so callers in app/ won't need to change.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getSports(): Promise<Sport[]> {
  return MOCK_SPORTS;
}

export async function getPredictions(sport: string, week?: number): Promise<Prediction[]> {
  return MOCK_PREDICTIONS.filter(
    (p) => p.sport === sport && (week === undefined || p.week === week)
  );
}

export async function getResults(sport: string, week?: number): Promise<Result[]> {
  return MOCK_RESULTS.filter(
    (r) => r.sport === sport && (week === undefined || r.week === week)
  );
}

export async function getAccuracy(sport: string): Promise<AccuracySummary> {
  return { ...MOCK_ACCURACY, sport };
}

export const isLiveApi = Boolean(API_BASE_URL);
