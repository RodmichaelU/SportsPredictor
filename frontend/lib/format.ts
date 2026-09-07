import { Prediction } from "./types";

// win_probability is always the home team's win probability; convert it to
// "confidence in the pick" so the UI can show one number per game.
export function pickConfidence(p: Pick<Prediction, "home_team" | "predicted_winner" | "win_probability">): number {
  return p.predicted_winner === p.home_team ? p.win_probability : 1 - p.win_probability;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatGameDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
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
