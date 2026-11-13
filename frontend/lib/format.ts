import { Prediction } from "./types";

// A home-team win probability, converted to "confidence in the pick" --
// one number per game regardless of which side was predicted. Shared by our
// own win_probability and by market_home_probability (Kalshi), so both are
// directly comparable in the same units.
function confidenceForHomeProbability(homeTeam: string, predictedWinner: string, homeProbability: number): number {
  return predictedWinner === homeTeam ? homeProbability : 1 - homeProbability;
}

export function pickConfidence(p: Pick<Prediction, "home_team" | "predicted_winner" | "win_probability">): number {
  return confidenceForHomeProbability(p.home_team, p.predicted_winner, p.win_probability);
}

export function marketConfidence(
  p: Pick<Prediction, "home_team" | "predicted_winner" | "market_home_probability">
): number | null {
  if (p.market_home_probability === null) return null;
  return confidenceForHomeProbability(p.home_team, p.predicted_winner, p.market_home_probability);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// Game dates are formatted when the static site is built, on a server whose
// clock is UTC, where a 5 PM game would already be tomorrow. Pinning one zone
// keeps every page (and the browser's re-render) on the same day and time.
export const SITE_TIME_ZONE = "America/Edmonton";

export function formatGameDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    timeZone: SITE_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMargin(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}
