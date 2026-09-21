import { AccuracySummary, Calibration, CurveTarget, EloHistoryPoint, Explanation, ModelCurve, ModelWeights, Prediction, Result, Sport, Standings, TeamDetail, TeamGame } from "./types";

// Placeholder data shaped like the real Phase 6 API responses will be, so the
// UI can be built and reviewed before the CFBD-backed pipeline exists.

export const MOCK_SPORTS: Sport[] = [
  { id: "cfb", name: "College Football", status: "live" },
  { id: "nfl", name: "NFL", status: "live" },
  { id: "nba", name: "NBA", status: "coming_soon" },
  { id: "nhl", name: "NHL", status: "coming_soon" },
];

const MODEL_VERSION = "mock-v0";

export const MOCK_PREDICTIONS: Prediction[] = [
  {
    game_id: "cfb-2026-w3-uga-ala",
    sport: "cfb",
    season: 2026,
    week: 3,
    home_team: "Alabama",
    away_team: "Georgia",
    game_date: "2026-09-19T19:30:00Z",
    predicted_at: "2026-09-16T12:00:00Z",
    win_probability: 0.42,
    predicted_winner: "Georgia",
    predicted_margin: -3.5,
    model_version: MODEL_VERSION,
    market_home_probability: 0.39,
  },
  {
    game_id: "cfb-2026-w3-osu-mich",
    sport: "cfb",
    season: 2026,
    week: 3,
    home_team: "Ohio State",
    away_team: "Michigan",
    game_date: "2026-09-19T16:00:00Z",
    predicted_at: "2026-09-16T12:00:00Z",
    win_probability: 0.64,
    predicted_winner: "Ohio State",
    predicted_margin: 6.5,
    model_version: MODEL_VERSION,
    market_home_probability: 0.68,
  },
  {
    game_id: "cfb-2026-w3-tex-lsu",
    sport: "cfb",
    season: 2026,
    week: 3,
    home_team: "LSU",
    away_team: "Texas",
    game_date: "2026-09-19T23:00:00Z",
    predicted_at: "2026-09-16T12:00:00Z",
    win_probability: 0.45,
    predicted_winner: "Texas",
    predicted_margin: 1.5,
    model_version: MODEL_VERSION,
    // No live Kalshi market matched -- demonstrates the "no market" case.
    market_home_probability: null,
  },
  {
    game_id: "cfb-2026-w3-ore-psu",
    sport: "cfb",
    season: 2026,
    week: 3,
    home_team: "Penn State",
    away_team: "Oregon",
    game_date: "2026-09-19T19:00:00Z",
    predicted_at: "2026-09-16T12:00:00Z",
    win_probability: 0.38,
    predicted_winner: "Oregon",
    predicted_margin: -4.0,
    model_version: MODEL_VERSION,
    market_home_probability: 0.35,
  },
  {
    game_id: "cfb-2026-w3-nd-tenn",
    sport: "cfb",
    season: 2026,
    week: 3,
    home_team: "Notre Dame",
    away_team: "Tennessee",
    game_date: "2026-09-19T17:00:00Z",
    predicted_at: "2026-09-16T12:00:00Z",
    win_probability: 0.71,
    predicted_winner: "Notre Dame",
    predicted_margin: 9.0,
    model_version: MODEL_VERSION,
    market_home_probability: 0.74,
  },
];

export const MOCK_RESULTS: Result[] = [
  {
    game_id: "cfb-2026-w2-clem-gt",
    sport: "cfb",
    season: 2026,
    week: 2,
    home_team: "Georgia Tech",
    away_team: "Clemson",
    game_date: "2026-09-12T19:30:00Z",
    predicted_at: "2026-09-09T12:00:00Z",
    win_probability: 0.39,
    predicted_winner: "Clemson",
    predicted_margin: 4.5,
    model_version: MODEL_VERSION,
    market_home_probability: null,
    home_score: 20,
    away_score: 27,
    actual_winner: "Clemson",
    actual_margin: 7,
    hit: true,
  },
  {
    game_id: "cfb-2026-w2-fsu-miami",
    sport: "cfb",
    season: 2026,
    week: 2,
    home_team: "Miami",
    away_team: "Florida State",
    game_date: "2026-09-12T23:30:00Z",
    predicted_at: "2026-09-09T12:00:00Z",
    win_probability: 0.58,
    predicted_winner: "Miami",
    predicted_margin: 3.0,
    model_version: MODEL_VERSION,
    market_home_probability: null,
    home_score: 17,
    away_score: 24,
    actual_winner: "Florida State",
    actual_margin: -7,
    hit: false,
  },
  {
    game_id: "cfb-2026-w2-utah-byu",
    sport: "cfb",
    season: 2026,
    week: 2,
    home_team: "BYU",
    away_team: "Utah",
    game_date: "2026-09-12T21:00:00Z",
    predicted_at: "2026-09-09T12:00:00Z",
    win_probability: 0.34,
    predicted_winner: "Utah",
    predicted_margin: 8.5,
    model_version: MODEL_VERSION,
    market_home_probability: null,
    home_score: 14,
    away_score: 31,
    actual_winner: "Utah",
    actual_margin: 17,
    hit: true,
  },
  {
    game_id: "cfb-2026-w2-wisc-iowa",
    sport: "cfb",
    season: 2026,
    week: 2,
    home_team: "Iowa",
    away_team: "Wisconsin",
    game_date: "2026-09-12T18:00:00Z",
    predicted_at: "2026-09-09T12:00:00Z",
    win_probability: 0.53,
    predicted_winner: "Iowa",
    predicted_margin: 1.0,
    model_version: MODEL_VERSION,
    market_home_probability: null,
    home_score: 23,
    away_score: 20,
    actual_winner: "Iowa",
    actual_margin: 3,
    hit: true,
  },
  {
    game_id: "cfb-2026-w2-okla-aub",
    sport: "cfb",
    season: 2026,
    week: 2,
    home_team: "Auburn",
    away_team: "Oklahoma",
    game_date: "2026-09-12T16:00:00Z",
    predicted_at: "2026-09-09T12:00:00Z",
    win_probability: 0.31,
    predicted_winner: "Oklahoma",
    predicted_margin: 10.5,
    model_version: MODEL_VERSION,
    market_home_probability: null,
    home_score: 21,
    away_score: 17,
    actual_winner: "Auburn",
    actual_margin: 4,
    hit: false,
  },
];

export const MOCK_ACCURACY: AccuracySummary = {
  sport: "cfb",
  sample_size: MOCK_RESULTS.length,
  accuracy: MOCK_RESULTS.filter((r) => r.hit).length / MOCK_RESULTS.length,
  log_loss: 0.612,
  brier_score: 0.211,
  ece: 0.045,
};

export const MOCK_CALIBRATION: Calibration = {
  sport: "cfb",
  sample_size: 240,
  bins: [
    { bin_start: 0.1, bin_end: 0.2, predicted_mean: 0.15, actual_rate: 0.18, count: 11 },
    { bin_start: 0.2, bin_end: 0.3, predicted_mean: 0.26, actual_rate: 0.22, count: 14 },
    { bin_start: 0.3, bin_end: 0.4, predicted_mean: 0.35, actual_rate: 0.31, count: 19 },
    { bin_start: 0.4, bin_end: 0.5, predicted_mean: 0.46, actual_rate: 0.51, count: 26 },
    { bin_start: 0.5, bin_end: 0.6, predicted_mean: 0.55, actual_rate: 0.58, count: 29 },
    { bin_start: 0.6, bin_end: 0.7, predicted_mean: 0.64, actual_rate: 0.6, count: 31 },
    { bin_start: 0.7, bin_end: 0.8, predicted_mean: 0.75, actual_rate: 0.7, count: 34 },
    { bin_start: 0.8, bin_end: 0.9, predicted_mean: 0.85, actual_rate: 0.88, count: 40 },
    { bin_start: 0.9, bin_end: 1.0, predicted_mean: 0.94, actual_rate: 0.93, count: 36 },
  ],
};

export const MOCK_MODEL_WEIGHTS: ModelWeights = {
  sport: "cfb",
  model_version: MODEL_VERSION,
  trained_on_games: 7884,
  weights: [
    { feature: "closing_spread", label: "Closing betting spread", weight: -1.391 },
    { feature: "sp_rating_diff", label: "SP+ overall rating gap", weight: 0.454 },
    { feature: "sp_offense_diff", label: "SP+ offense rating gap", weight: -0.412 },
    { feature: "sp_defense_diff", label: "SP+ defense rating gap", weight: 0.327 },
    { feature: "elo_diff", label: "Elo rating gap", weight: 0.225 },
    { feature: "def_success_rate_diff", label: "Defensive success rate allowed gap", weight: -0.159 },
    { feature: "def_ppa_diff", label: "Defensive EPA/play allowed gap", weight: 0.135 },
    { feature: "off_points_per_drive_diff", label: "Points per drive gap (offense)", weight: 0.113 },
    { feature: "off_ppa_diff", label: "Offensive EPA/play gap", weight: -0.080 },
    { feature: "talent_diff", label: "Recruiting talent composite gap", weight: 0.055 },
    { feature: "rest_days_diff", label: "Rest days gap", weight: 0.016 },
    { feature: "neutral_site", label: "Neutral site game", weight: 0.002 },
  ],
};

export const MOCK_EXPLANATION: Explanation = {
  sport: "cfb",
  game_id: "mock-game",
  home_team: "Alabama",
  away_team: "Georgia",
  predicted_winner: "Georgia",
  win_probability: 0.42,
  model_version: MODEL_VERSION,
  market_home_probability: 0.39,
  groups: [
    {
      key: "market",
      label: "Betting market",
      contribution: -0.58,
      favored_team: "Georgia",
      details: ["Georgia favored by 3.5 points"],
    },
    {
      key: "sp_plus",
      label: "SP+ ratings",
      contribution: -0.31,
      favored_team: "Georgia",
      details: [
        "SP+ overall rating: Alabama 24 vs Georgia 30",
        "SP+ offense rating: Alabama 34 vs Georgia 31",
        "SP+ defense rating: Alabama 12 vs Georgia 8",
      ],
    },
    {
      key: "elo",
      label: "Elo rating",
      contribution: -0.19,
      favored_team: "Georgia",
      details: ["Elo rating: Alabama 1780 vs Georgia 1865"],
    },
    {
      key: "defense_stats",
      label: "This season's defensive stats",
      contribution: 0.12,
      favored_team: "Alabama",
      details: [
        "Defensive EPA/play allowed: Alabama 0.08 vs Georgia 0.14",
        "Points per drive allowed: Alabama 1.6 vs Georgia 1.9",
      ],
    },
    {
      key: "offense_stats",
      label: "This season's offensive stats",
      contribution: 0.07,
      favored_team: "Alabama",
      details: ["Offensive EPA/play: Alabama 0.31 vs Georgia 0.27"],
    },
    {
      key: "talent",
      label: "Recruiting talent",
      contribution: -0.05,
      favored_team: "Georgia",
      details: ["Recruiting talent composite: Alabama 920 vs Georgia 960"],
    },
    {
      key: "rest",
      label: "Rest days",
      contribution: 0.01,
      favored_team: "Alabama",
      details: ["Rest days: Alabama 7.00 vs Georgia 6.00"],
    },
    {
      key: "context",
      label: "Game context",
      contribution: 0.0,
      favored_team: "Alabama",
      details: ["Neutral site game: No", "Conference game: Yes"],
    },
  ],
};

// Synthetic sigmoid (win) / straight line (margin) so the curve view has
// something reasonable to render without the backend running. Not real
// model output -- just illustrative shapes.
export function mockModelCurve(sport: string, feature: string, target: CurveTarget): ModelCurve {
  const n = 30;
  const xs = Array.from({ length: n }, (_, i) => -600 + (1200 * i) / (n - 1));
  const curve =
    target === "win"
      ? xs.map((x) => ({ x, y: 1 / (1 + Math.exp(-x / 200)) }))
      : xs.map((x) => ({ x, y: x / 20 }));

  const scatter = Array.from({ length: 120 }, () => {
    const x = -600 + Math.random() * 1200;
    if (target === "win") {
      const p = 1 / (1 + Math.exp(-x / 200));
      return { x, y: (Math.random() < p ? 1 : 0) + (Math.random() - 0.5) * 0.08 };
    }
    return { x, y: x / 20 + (Math.random() - 0.5) * 20 };
  });

  return { sport, feature, label: feature.replace(/_/g, " "), target, curve, scatter };
}

export const MOCK_TEAMS: string[] = [
  ...new Set([...MOCK_PREDICTIONS, ...MOCK_RESULTS].flatMap((g) => [g.home_team, g.away_team])),
].sort();

export function mockTeamDetail(sport: string, team: string): TeamDetail {
  const games: TeamGame[] = [...MOCK_PREDICTIONS, ...MOCK_RESULTS]
    .filter((g) => g.home_team === team || g.away_team === team)
    .map((g) => ({
      ...g,
      home_score: "home_score" in g ? (g as Result).home_score : null,
      away_score: "away_score" in g ? (g as Result).away_score : null,
      actual_winner: "actual_winner" in g ? (g as Result).actual_winner : null,
      actual_margin: "actual_margin" in g ? (g as Result).actual_margin : null,
      hit: "hit" in g ? (g as Result).hit : null,
    }))
    .sort((a, b) => a.game_date.localeCompare(b.game_date));

  const wins = games.filter((g) => g.actual_winner === team).length;
  const losses = games.filter((g) => g.actual_winner !== null && g.actual_winner !== team).length;

  let rating = 1650;
  const elo_history: EloHistoryPoint[] = games
    .filter((g) => g.hit !== null)
    .map((g) => {
      const opponent = g.home_team === team ? g.away_team : g.home_team;
      const rating_before = rating;
      rating += g.actual_winner === team ? 22 : -18;
      return { game_date: g.game_date, opponent, rating_before, rating_after: rating };
    });

  return {
    sport,
    team,
    record: { wins, losses },
    current_elo: elo_history.length > 0 ? elo_history[elo_history.length - 1].rating_after : null,
    elo_history,
    games,
  };
}

export const MOCK_STANDINGS: Standings = {
  sport: "cfb",
  season: 2026,
  groups: [
    {
      group: "SEC",
      teams: [
        { team: "Georgia", wins: 3, losses: 0 },
        { team: "Alabama", wins: 2, losses: 1 },
        { team: "Auburn", wins: 2, losses: 1 },
        { team: "Oklahoma", wins: 1, losses: 2 },
      ],
    },
    {
      group: "Big Ten",
      teams: [
        { team: "Ohio State", wins: 3, losses: 0 },
        { team: "Michigan", wins: 2, losses: 1 },
        { team: "Iowa", wins: 1, losses: 2 },
        { team: "Wisconsin", wins: 0, losses: 3 },
      ],
    },
  ],
};
