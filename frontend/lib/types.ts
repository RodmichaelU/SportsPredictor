// Mirrors the Phase 6 FastAPI contract (see PLAN.md). Field names match what
// api/main.py will return so the frontend doesn't need a translation layer.

export interface Sport {
  id: string;
  name: string;
}

export interface Prediction {
  game_id: string;
  sport: string;
  season: number;
  week: number;
  home_team: string;
  away_team: string;
  game_date: string; // ISO timestamp, pre-kickoff
  predicted_at: string; // ISO timestamp, when the prediction was frozen
  win_probability: number; // home team win probability, 0-1
  predicted_winner: string;
  predicted_margin: number; // predicted home score minus away score
  model_version: string;
}

export interface Result extends Prediction {
  home_score: number;
  away_score: number;
  actual_winner: string;
  actual_margin: number;
  hit: boolean;
}

export interface AccuracySummary {
  sport: string;
  sample_size: number;
  // Null when sample_size is 0 -- no games have been reconciled yet.
  accuracy: number | null;
  log_loss: number | null;
  brier_score: number | null;
  ece: number | null;
}

export interface FeatureWeight {
  feature: string;
  label: string;
  weight: number; // standardized logistic regression coefficient
}

export interface ModelWeights {
  sport: string;
  model_version: string;
  trained_on_games: number;
  weights: FeatureWeight[]; // sorted by |weight| descending
}

export interface ExplanationGroup {
  key: string;
  label: string;
  contribution: number; // signed; >=0 favors home_team, <0 favors away_team
  favored_team: string;
  details: string[]; // human-readable supporting lines, e.g. raw stat comparisons
}

export interface Explanation {
  sport: string;
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_winner: string;
  win_probability: number;
  model_version: string;
  groups: ExplanationGroup[]; // sorted by |contribution| descending
}
