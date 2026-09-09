"""Build a one-row-per-game feature table with pre-game-only features for
NFL, mirroring src.sports.cfb.features's discipline (season-to-date rolling
stats via an expanding mean shifted by one game, sorted by actual date) but
with a leaner feature set: nflreadpy doesn't have a CFBD-style advanced-stats
endpoint, so EPA/play is the one team-strength signal computed here. Rest
days and the closing spread come straight from the schedule (nflreadpy
precomputes both, even for not-yet-played games), and pregame Elo comes from
our own elo.py rather than an external rating (NFL has no CFBD-style
pregame-Elo field).

Run: python -m src.sports.nfl.features [--start YEAR] [--end YEAR]
"""

import argparse

import pandas as pd

import config
from src import elo
from src.sports.nfl import ingest

ROLLING_STAT_COLUMNS = ["off_epa", "def_epa_allowed"]
DIFF_BASES = ROLLING_STAT_COLUMNS
FEATURE_COLUMNS = ["elo_diff"] + [f"{b}_diff" for b in DIFF_BASES] + [
    "rest_days_diff", "closing_spread", "neutral_site", "div_game",
]
FEATURES_PATH = config.PROCESSED_DIR / "nfl_features.parquet"

# Human-readable labels for FEATURE_COLUMNS, for the frontend's model-weights
# view. All "_diff" features are home minus away.
FEATURE_LABELS = {
    "elo_diff": "Elo rating gap",
    "off_epa_diff": "Offensive EPA/play gap",
    "def_epa_allowed_diff": "Defensive EPA/play allowed gap",
    "rest_days_diff": "Rest days gap",
    "closing_spread": "Closing betting spread",
    "neutral_site": "Neutral site game",
    "div_game": "Division game",
}


def _team_game_stats_frame(start_season: int, end_season: int) -> pd.DataFrame:
    """One row per team per game: this team's EPA/play, offense and defense
    (defense = the opponent's offensive EPA in that same game -- nflreadpy's
    team stats are offense/special-teams-shaped, not split out defensively
    the way CFBD's advanced stats already are)."""
    stats = ingest.ingest_team_stats(start_season, end_season)
    if stats.empty:
        return pd.DataFrame(columns=["season", "week", "game_id", "team", "off_epa", "def_epa_allowed"])
    stats = stats.copy()
    stats["off_epa"] = stats["passing_epa"].fillna(0) + stats["rushing_epa"].fillna(0)

    opponent_epa = stats[["game_id", "team", "off_epa"]].rename(
        columns={"team": "opponent_team", "off_epa": "def_epa_allowed"}
    )
    merged = stats.merge(opponent_epa, on=["game_id", "opponent_team"], how="left")
    return merged[["season", "week", "game_id", "team", "off_epa", "def_epa_allowed"]]


def season_to_date_stats(team_game_stats: pd.DataFrame) -> pd.DataFrame:
    """Same leak-free construction as cfb.features.season_to_date_stats:
    expanding mean shifted by one game, so a row reflects only strictly
    earlier games this season. Sorted by week -- unlike CFB, NFL teams play
    at most one game per week, so week order is already chronological."""
    df = team_game_stats.sort_values(["season", "team", "week"]).copy()
    grouped = df.groupby(["season", "team"])
    for col in ROLLING_STAT_COLUMNS:
        df[col] = grouped[col].transform(lambda s: s.shift(1).expanding().mean())
    return df


def _current_team_snapshot(team_game_stats: pd.DataFrame) -> pd.DataFrame:
    """Each team's rolling average through their most recent completed game
    (not shifted -- there's no "own game" to exclude), for upcoming games."""
    cols = ["team", "last_week"] + ROLLING_STAT_COLUMNS
    if team_game_stats.empty:
        return pd.DataFrame(columns=cols)
    df = team_game_stats.sort_values(["team", "week"]).copy()
    grouped = df.groupby("team")
    for col in ROLLING_STAT_COLUMNS:
        df[col] = grouped[col].transform(lambda s: s.expanding().mean())
    snapshot = df.groupby("team", as_index=False).last().rename(columns={"week": "last_week"})
    return snapshot[cols]


def _elo_ratings_for_range(start_season: int, end_season: int) -> pd.DataFrame:
    """Our own from-scratch Elo (Phase 3) as the pregame-rating feature,
    since NFL has no CFBD-style external pregame Elo to lean on. Computed
    once per call with the already-tuned constants above -- callers that
    need multiple seasons should call this once and reuse it, not call it
    per season (each call re-simulates the whole range)."""
    games = ingest.load_games(start_season, end_season)
    predictions = elo.simulate(games, ingest.ELO_K, ingest.ELO_HOME_ADVANTAGE)
    return predictions[["game_id", "home_pregame_elo", "away_pregame_elo"]]


def _build_season_features(season: int, elo_ratings: pd.DataFrame) -> pd.DataFrame:
    sched = ingest.ingest_schedules(season, season)
    sched = sched[sched["game_type"] == ingest.SEASON_TYPE]
    completed = sched.dropna(subset=["home_score", "away_score"]).copy()
    if completed.empty:
        return pd.DataFrame()

    team_stats = _team_game_stats_frame(season, season)
    std = season_to_date_stats(team_stats)

    def side(prefix: str, team_col: str, rest_col: str) -> pd.DataFrame:
        merged = completed[["game_id", team_col, rest_col]].merge(
            std, left_on=["game_id", team_col], right_on=["game_id", "team"], how="left"
        )
        out = merged[["game_id"] + ROLLING_STAT_COLUMNS + [rest_col]]
        out = out.rename(columns={c: f"{prefix}_{c}" for c in ROLLING_STAT_COLUMNS})
        out = out.rename(columns={rest_col: f"{prefix}_rest_days"})
        return out

    home = side("home", "home_team", "home_rest")
    away = side("away", "away_team", "away_rest")

    result = completed.merge(home, on="game_id").merge(away, on="game_id")
    result = result.merge(elo_ratings, on="game_id", how="left")

    result["closing_spread"] = -result["spread_line"]  # flip to CFB convention: negative = home favored
    result["neutral_site"] = (result["location"] == "Neutral").astype(int)
    result["div_game"] = result["div_game"].astype(int)
    result["home_win"] = (result["home_score"] > result["away_score"]).astype(int)
    result["margin"] = result["home_score"] - result["away_score"]

    result = result.rename(
        columns={"kickoff": "start_date", "home_score": "home_points", "away_score": "away_points"}
    )
    result["start_date"] = result["start_date"].dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    keep = (
        ["game_id", "season", "week", "start_date", "home_team", "away_team",
         "neutral_site", "div_game", "home_pregame_elo", "away_pregame_elo",
         "closing_spread", "home_points", "away_points", "home_win", "margin"]
        + [f"home_{c}" for c in ROLLING_STAT_COLUMNS] + ["home_rest_days"]
        + [f"away_{c}" for c in ROLLING_STAT_COLUMNS] + ["away_rest_days"]
    )
    return result[keep]


def build_season_features(season: int) -> pd.DataFrame:
    elo_ratings = _elo_ratings_for_range(config.START_SEASON, season)
    return _build_season_features(season, elo_ratings)


def build_upcoming_features(season: int, week: int) -> pd.DataFrame:
    sched = ingest.ingest_schedules(season, season)
    sched = sched[sched["game_type"] == ingest.SEASON_TYPE]
    completed = sched.dropna(subset=["home_score", "away_score"])
    target = sched[(sched["week"] == week) & sched["home_score"].isna()].copy()
    if target.empty:
        return pd.DataFrame()

    team_stats = _team_game_stats_frame(season, season)
    snapshot = _current_team_snapshot(team_stats)
    elo_ratings = (
        _elo_ratings_for_range(config.START_SEASON, season)
        if not completed.empty
        else pd.DataFrame(columns=["game_id", "home_pregame_elo", "away_pregame_elo"])
    )

    def side(prefix: str, team_col: str, rest_col: str) -> pd.DataFrame:
        merged = target[["game_id", team_col, rest_col]].merge(
            snapshot, left_on=team_col, right_on="team", how="left"
        )
        out = merged[["game_id"] + ROLLING_STAT_COLUMNS + [rest_col]]
        out = out.rename(columns={c: f"{prefix}_{c}" for c in ROLLING_STAT_COLUMNS})
        out = out.rename(columns={rest_col: f"{prefix}_rest_days"})
        return out

    home = side("home", "home_team", "home_rest")
    away = side("away", "away_team", "away_rest")

    result = target.merge(home, on="game_id").merge(away, on="game_id")
    result = result.merge(elo_ratings, on="game_id", how="left")

    result["closing_spread"] = -result["spread_line"]
    result["neutral_site"] = (result["location"] == "Neutral").astype(int)
    result["div_game"] = result["div_game"].astype(int)

    result = result.rename(columns={"kickoff": "start_date"})
    result["start_date"] = result["start_date"].dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    keep = (
        ["game_id", "season", "week", "start_date", "home_team", "away_team",
         "neutral_site", "div_game", "home_pregame_elo", "away_pregame_elo",
         "closing_spread"]
        + [f"home_{c}" for c in ROLLING_STAT_COLUMNS] + ["home_rest_days"]
        + [f"away_{c}" for c in ROLLING_STAT_COLUMNS] + ["away_rest_days"]
    )
    return result[keep]


def build_features(start_season: int, end_season: int) -> pd.DataFrame:
    elo_ratings = _elo_ratings_for_range(start_season, end_season)
    frames = [_build_season_features(year, elo_ratings) for year in range(start_season, end_season + 1)]
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True)


def add_model_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["elo_diff"] = df["home_pregame_elo"] - df["away_pregame_elo"]
    for base in DIFF_BASES:
        df[f"{base}_diff"] = df[f"home_{base}"] - df[f"away_{base}"]
    df["rest_days_diff"] = df["home_rest_days"] - df["away_rest_days"]
    return df


def load_feature_table() -> pd.DataFrame:
    return add_model_features(pd.read_parquet(FEATURES_PATH))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    df = build_features(args.start, args.end)
    df.to_parquet(FEATURES_PATH, index=False)
    print(f"Wrote {len(df)} rows, {len(df.columns)} columns to {FEATURES_PATH}")


if __name__ == "__main__":
    main()
