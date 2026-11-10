// Mirrors the Phase 6 FastAPI contract (see PLAN.md). Field names match what
// api/main.py will return so the frontend doesn't need a translation layer.

export interface Sport {
  id: string;
  name: string;
  // "coming_soon" sports have a working data pipeline and Elo ratings but no
  // trained model yet -- the frontend shows a placeholder instead of calling
  // prediction endpoints that don't have data (or, for /model, don't exist
  // yet) for them.
  status: "live" | "coming_soon";
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
  // Live home-team win probability from Kalshi (a real-money prediction
  // market), matched by team name -- null if no open Kalshi market was
  // found for this game. Only populated for upcoming games; already-decided
  // games don't have a live market to compare against.
  market_home_probability: number | null;
  // "live" when fetched from Kalshi for this request, "snapshot" when it's
  // the latest pre-game price refresh.py saved (Kalshi unreachable live).
  market_source: "live" | "snapshot" | null;
  market_captured_at: string | null; // ISO timestamp; set for snapshots only
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
  market_home_probability: number | null; // Kalshi price (live or latest snapshot), null if no market matched
  market_source: "live" | "snapshot" | null;
  market_captured_at: string | null;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export type CurveTarget = "win" | "margin";

export interface ModelCurve {
  sport: string;
  feature: string;
  label: string;
  target: CurveTarget;
  curve: CurvePoint[]; // the fitted model's prediction as `feature` sweeps its range, others held at median
  scatter: CurvePoint[]; // a sample of real historical (feature, actual outcome) points
}

export interface CalibrationBin {
  bin_start: number;
  bin_end: number;
  predicted_mean: number; // average predicted home win probability in this bucket
  actual_rate: number; // actual home win rate in this bucket
  count: number;
}

export interface Calibration {
  sport: string;
  sample_size: number;
  bins: CalibrationBin[]; // empty buckets omitted
}

export interface TeamGame extends Prediction {
  // null until reconcile.py scores this game -- same "not yet reconciled,
  // not necessarily not yet played" caveat as elsewhere.
  home_score: number | null;
  away_score: number | null;
  actual_winner: string | null;
  actual_margin: number | null;
  hit: boolean | null;
}

export interface EloHistoryPoint {
  game_date: string;
  opponent: string;
  rating_before: number;
  rating_after: number;
}

export interface TeamDetail {
  sport: string;
  team: string;
  record: { wins: number; losses: number };
  current_elo: number | null;
  elo_history: EloHistoryPoint[]; // this season only, chronological
  games: TeamGame[]; // every game with a frozen prediction, chronological
}

export interface StandingsTeam {
  team: string;
  wins: number;
  losses: number;
}

export interface StandingsGroup {
  group: string; // conference (CFB) or "<Conference> <Division>" (NFL)
  teams: StandingsTeam[]; // sorted by win pct, then win count, descending
}

export interface Standings {
  sport: string;
  season: number;
  groups: StandingsGroup[]; // sorted by group name; empty for sports with no standings() source yet
}

export interface WeeklyAccuracy {
  season: number;
  week: number;
  sample_size: number;
  accuracy: number;
}

export interface AccuracyByWeek {
  sport: string;
  weeks: WeeklyAccuracy[]; // chronological; only weeks with at least one reconciled game
}

export type ParlayTierKey = "low" | "medium" | "high";

export interface ParlayLeg {
  game_id: string;
  sport: string;
  team: string; // the side this leg backs
  opponent: string;
  is_home: boolean;
  game_date: string;
  model_probability: number; // our model's chance this side wins
  market_probability: number; // the market's implied chance (== the price)
  edge: number; // model_probability - market_probability
  decimal_odds: number;
  american_odds: number;
  market_source: "live" | "snapshot" | null;
  market_captured_at: string | null;
}

// One risk tier from /parlays (src/parlay.py). Unavailable tiers carry a
// reason instead of legs and totals.
export interface ParlayTier {
  tier: ParlayTierKey;
  label: string;
  available: boolean;
  // false for a fallback: no legs cleared the tier's value bar, so these are
  // the model's likeliest picks regardless of price (see src/parlay.py).
  value: boolean;
  legs: ParlayLeg[];
  reason?: string;
  note?: string; // set on fallback parlays, explaining why it isn't a value pick
  hit_probability?: number; // model's chance every leg hits (legs assumed independent)
  market_hit_probability?: number;
  decimal_odds?: number;
  american_odds?: number;
  expected_return?: number; // per $1 staked, if the model's probabilities are right
}

export interface Parlays {
  sports: string[];
  generated_at: string;
  priced_games: number;
  tiers: ParlayTier[];
  candidates: ParlayLeg[]; // every pickable side, for the build-your-own rater
}

export type LegVerdict = "value" | "fair" | "overpriced" | "suspect";

export interface RatedLeg extends ParlayLeg {
  verdict: LegVerdict;
  // The probability the rating trusts: the model's, except for "suspect"
  // legs (gap too large to believe), which count at the market's price.
  trusted_probability: number;
}

// /parlay-rating's grade for a user-built parlay (src/parlay.py rate_parlay).
export interface ParlayRating {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  legs: RatedLeg[];
  hit_probability: number;
  market_hit_probability: number;
  decimal_odds: number;
  american_odds: number;
  expected_return: number;
  counts: Record<LegVerdict, number>;
  weakest_leg: { team: string; verdict: LegVerdict; model_probability: number; market_probability: number } | null;
}
