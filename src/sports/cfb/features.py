"""Build a one-row-per-game feature table with pre-game-only features.

Every rolling/season-to-date stat is computed with a strict week < target_week
filter within the same season (an expanding mean shifted by one game), so a
team's stats from the game being predicted, or any later game, never leak in.
Preseason inputs (talent composite, prior-season SP+, CFBD's own pregame Elo)
are safe to use as-is since they're fixed before the season/game starts.

Run: python -m src.sports.cfb.features [--start YEAR] [--end YEAR]
"""

import argparse

import pandas as pd

import config
from src.sports.cfb import ingest

ROLLING_STAT_COLUMNS = [
    "off_ppa",
    "off_success_rate",
    "off_explosiveness",
    "off_points_per_drive",
    "def_ppa",
    "def_success_rate",
    "def_explosiveness",
    "def_points_per_drive",
]

# Diff features (home - away) for symmetric matchup modeling, plus a few
# game-context fields that aren't team-specific. Consumed by models.py /
# evaluate.py via FEATURE_COLUMNS and load_feature_table() below -- neither
# of those modules knows these particular column names exist.
DIFF_BASES = ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]
FEATURE_COLUMNS = ["elo_diff"] + [f"{b}_diff" for b in DIFF_BASES] + [
    "closing_spread", "neutral_site", "conference_game",
]
FEATURES_PATH = config.PROCESSED_DIR / "cfb_features.parquet"

# Human-readable labels for FEATURE_COLUMNS, for the frontend's model-weights
# view. All "_diff" features are home minus away, so e.g. a positive
# elo_diff means the home team is rated higher.
FEATURE_LABELS = {
    "elo_diff": "Elo rating gap",
    "off_ppa_diff": "Offensive EPA/play gap",
    "off_success_rate_diff": "Offensive success rate gap",
    "off_explosiveness_diff": "Offensive explosiveness gap",
    "off_points_per_drive_diff": "Points per drive gap (offense)",
    "def_ppa_diff": "Defensive EPA/play allowed gap",
    "def_success_rate_diff": "Defensive success rate allowed gap",
    "def_explosiveness_diff": "Defensive explosiveness allowed gap",
    "def_points_per_drive_diff": "Points per drive allowed gap (defense)",
    "rest_days_diff": "Rest days gap",
    "talent_diff": "Recruiting talent composite gap",
    "sp_rating_diff": "SP+ overall rating gap",
    "sp_offense_diff": "SP+ offense rating gap",
    "sp_defense_diff": "SP+ defense rating gap",
    "closing_spread": "Closing betting spread",
    "neutral_site": "Neutral site game",
    "conference_game": "Conference game",
}

# Groups for the per-game explanation view (api/main.py's /explain). SP+
# overall/offense/defense are correlated with each other (overall is roughly
# a combination of the other two), and so are the four offensive and four
# defensive rolling stats -- correlated inputs to a linear model can end up
# with individual coefficients that point the "wrong" way (e.g. SP+ offense
# gap has a *negative* global weight despite more offense intuitively
# helping) even though the model's predictions are still correct overall.
# Summing each family's contributions into one number is far more likely to
# land on the intuitive direction than any single correlated sub-feature.
FEATURE_GROUPS = [
    {"key": "market", "label": "Betting market", "features": ["closing_spread"]},
    {"key": "elo", "label": "Elo rating", "features": ["elo_diff"]},
    {"key": "sp_plus", "label": "SP+ ratings", "features": ["sp_rating_diff", "sp_offense_diff", "sp_defense_diff"]},
    {"key": "talent", "label": "Recruiting talent", "features": ["talent_diff"]},
    {
        "key": "offense_stats",
        "label": "This season's offensive stats",
        "features": ["off_ppa_diff", "off_success_rate_diff", "off_explosiveness_diff", "off_points_per_drive_diff"],
    },
    {
        "key": "defense_stats",
        "label": "This season's defensive stats",
        "features": ["def_ppa_diff", "def_success_rate_diff", "def_explosiveness_diff", "def_points_per_drive_diff"],
    },
    {"key": "rest", "label": "Rest days", "features": ["rest_days_diff"]},
    {"key": "context", "label": "Game context", "features": ["neutral_site", "conference_game"]},
]


def _games_frame(season: int) -> pd.DataFrame:
    games = ingest.ingest_games(season)
    df = pd.DataFrame(games)
    df = df[df["completed"] == True]  # noqa: E712
    df = df[(df["homeClassification"] == "fbs") & (df["awayClassification"] == "fbs")]
    return df


def _team_game_stats_frame(season: int, games_df: pd.DataFrame) -> pd.DataFrame:
    """One row per team per game: this team's offense/defense advanced stats
    plus points scored/allowed, for season-to-date rolling aggregation."""
    stats = ingest.ingest_game_stats(season)
    if not stats:
        return pd.DataFrame(
            columns=["season", "week", "start_date", "gameId", "team"] + ROLLING_STAT_COLUMNS
        )

    scores = {}
    dates = {}
    for _, g in games_df.iterrows():
        scores[(g["id"], g["homeTeam"])] = (g["homePoints"], g["awayPoints"])
        scores[(g["id"], g["awayTeam"])] = (g["awayPoints"], g["homePoints"])
        dates[g["id"]] = g["startDate"]

    rows = []
    for s in stats:
        key = (s["gameId"], s["team"])
        if key not in scores:
            continue  # game not in our completed/FBS games_df (e.g. FCS opponent)
        team_points, opp_points = scores[key]
        offense = s.get("offense") or {}
        defense = s.get("defense") or {}
        off_drives = offense.get("drives") or None
        def_drives = defense.get("drives") or None
        rows.append(
            {
                "season": s["season"],
                "week": s["week"],
                "start_date": dates[s["gameId"]],
                "gameId": s["gameId"],
                "team": s["team"],
                "off_ppa": offense.get("ppa"),
                "off_success_rate": offense.get("successRate"),
                "off_explosiveness": offense.get("explosiveness"),
                "off_points_per_drive": (team_points / off_drives) if off_drives else None,
                "def_ppa": defense.get("ppa"),
                "def_success_rate": defense.get("successRate"),
                "def_explosiveness": defense.get("explosiveness"),
                "def_points_per_drive": (opp_points / def_drives) if def_drives else None,
            }
        )
    return pd.DataFrame(rows)


def season_to_date_stats(team_game_stats: pd.DataFrame) -> pd.DataFrame:
    """Expanding mean of each rolling stat, shifted by one game, per team per
    season, so the value attached to a game reflects only strictly earlier
    games in time (never the target game or a later one). Sorted by actual
    kickoff timestamp, not week number: some teams play twice in the same
    CFBD "week" (e.g. Week 0/1 openers), so week alone isn't a safe order."""
    df = team_game_stats.sort_values(["season", "team", "start_date"]).copy()
    grouped = df.groupby(["season", "team"])
    for col in ROLLING_STAT_COLUMNS:
        df[col] = grouped[col].transform(lambda s: s.shift(1).expanding().mean())
    return df


def _rest_days(team_game_stats: pd.DataFrame) -> pd.DataFrame:
    """Days since each team's previous game this season (NaN for their first)."""
    df = team_game_stats.sort_values(["season", "team", "start_date"]).copy()
    df["prev_game_date"] = df.groupby(["season", "team"])["start_date"].shift(1)
    df["rest_days"] = (
        pd.to_datetime(df["start_date"], utc=True) - pd.to_datetime(df["prev_game_date"], utc=True)
    ).dt.days
    return df[["season", "gameId", "team", "rest_days"]]


def _talent_map(season: int) -> dict:
    talent = ingest.ingest_talent(season)
    return {t["team"]: t["talent"] for t in talent}


def _sp_map(season: int) -> dict:
    if season < config.START_SEASON:
        return {}
    sp = ingest.ingest_sp_ratings(season)
    return {
        r["team"]: {
            "sp_rating": r.get("rating"),
            "sp_offense": (r.get("offense") or {}).get("rating"),
            "sp_defense": (r.get("defense") or {}).get("rating"),
        }
        for r in sp
    }


def _closing_spread_map(season: int) -> dict:
    lines = ingest.ingest_lines(season)
    result = {}
    for game in lines:
        game_lines = game.get("lines") or []
        if not game_lines:
            continue
        chosen = next((l for l in game_lines if l.get("provider") == "consensus"), game_lines[0])
        if chosen.get("spread") is not None:
            result[game["id"]] = chosen["spread"]
    return result


def _side_frame(std: pd.DataFrame, rest: pd.DataFrame, talent: dict, prev_sp: dict, prefix: str) -> pd.DataFrame:
    """std joined with rest days and preseason inputs, columns prefixed
    home_/away_ and keyed by gameId + <prefix>Team for merging onto games."""
    merged = std.merge(rest, on=["season", "gameId", "team"], how="left")
    merged["talent"] = merged["team"].map(talent)
    sp_df = pd.DataFrame.from_dict(prev_sp, orient="index")
    if not sp_df.empty:
        merged = merged.merge(sp_df, left_on="team", right_index=True, how="left")
    else:
        merged["sp_rating"] = float("nan")
        merged["sp_offense"] = float("nan")
        merged["sp_defense"] = float("nan")

    feature_cols = ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]
    merged = merged[["gameId", "team"] + feature_cols]
    merged = merged.rename(columns={c: f"{prefix}_{c}" for c in feature_cols})
    merged = merged.rename(columns={"gameId": "id", "team": f"{prefix}Team"})
    return merged


def _build_historical_features(season: int, games_df: pd.DataFrame) -> pd.DataFrame:
    """Feature rows for already-played games_df. Rolling stats are joined by
    (gameId, team), which only works because every target game is also one
    of the games its own rolling average is built from (shifted out of its
    own average, per season_to_date_stats) -- see build_upcoming_features for
    why that join key doesn't work for not-yet-played games."""
    history_df = target_df = games_df
    team_stats = _team_game_stats_frame(season, history_df)
    std = season_to_date_stats(team_stats)
    rest = _rest_days(team_stats)

    talent = _talent_map(season)
    prev_sp = _sp_map(season - 1)
    closing_spread = _closing_spread_map(season)

    home_frame = _side_frame(std, rest, talent, prev_sp, "home")
    away_frame = _side_frame(std, rest, talent, prev_sp, "away")

    result = target_df.merge(home_frame, on=["id", "homeTeam"], how="left")
    result = result.merge(away_frame, on=["id", "awayTeam"], how="left")

    result["closing_spread"] = result["id"].map(closing_spread)

    result = result.rename(
        columns={
            "id": "game_id",
            "startDate": "start_date",
            "homeTeam": "home_team",
            "awayTeam": "away_team",
            "neutralSite": "neutral_site",
            "conferenceGame": "conference_game",
            "homePregameElo": "home_pregame_elo",
            "awayPregameElo": "away_pregame_elo",
            "homePoints": "home_points",
            "awayPoints": "away_points",
        }
    )

    keep = (
        ["game_id", "season", "week", "start_date", "home_team", "away_team",
         "neutral_site", "conference_game", "home_pregame_elo", "away_pregame_elo",
         "closing_spread"]
        + [f"home_{c}" for c in ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]]
        + [f"away_{c}" for c in ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]]
    )

    if result["home_points"].notna().any():
        result["home_win"] = (result["home_points"] > result["away_points"]).astype(int)
        result["margin"] = result["home_points"] - result["away_points"]
        keep += ["home_points", "away_points", "home_win", "margin"]

    return result[keep]


def build_season_features(season: int) -> pd.DataFrame:
    games_df = _games_frame(season)
    if games_df.empty:
        return pd.DataFrame()
    return _build_historical_features(season, games_df)


def _current_team_snapshot(team_game_stats: pd.DataFrame) -> pd.DataFrame:
    """One row per team: their rolling-stat averages and most recent game
    date, through their last completed game. Unlike season_to_date_stats
    (which excludes each row's own game, for attaching to a historical game
    that's part of the average), this includes every game played so far --
    there's no "own game" to exclude, because it's used for a game that
    hasn't happened yet."""
    cols = ["team", "last_game_date"] + ROLLING_STAT_COLUMNS
    if team_game_stats.empty:
        return pd.DataFrame(columns=cols)
    df = team_game_stats.sort_values(["team", "start_date"]).copy()
    grouped = df.groupby("team")
    for col in ROLLING_STAT_COLUMNS:
        df[col] = grouped[col].transform(lambda s: s.expanding().mean())
    snapshot = df.groupby("team", as_index=False).last().rename(columns={"start_date": "last_game_date"})
    return snapshot[cols]


def _side_frame_upcoming(snapshot: pd.DataFrame, talent: dict, prev_sp: dict, prefix: str) -> pd.DataFrame:
    merged = snapshot.copy()
    merged["talent"] = merged["team"].map(talent)
    sp_df = pd.DataFrame.from_dict(prev_sp, orient="index")
    if not sp_df.empty:
        merged = merged.merge(sp_df, left_on="team", right_index=True, how="left")
    else:
        merged["sp_rating"] = float("nan")
        merged["sp_offense"] = float("nan")
        merged["sp_defense"] = float("nan")

    feature_cols = ["last_game_date"] + ROLLING_STAT_COLUMNS + ["talent", "sp_rating", "sp_offense", "sp_defense"]
    merged = merged[["team"] + feature_cols]
    merged = merged.rename(columns={c: f"{prefix}_{c}" for c in feature_cols})
    merged = merged.rename(columns={"team": f"{prefix}Team"})
    return merged


def build_upcoming_features(season: int, week: int) -> pd.DataFrame:
    """Feature rows for a season/week's not-yet-played games, for predict.py.
    Pulls the season fresh (not just the historical cache) since an
    in-progress season's schedule and completed-game stats change week to
    week.

    Rolling stats can't be joined by gameId the way build_season_features
    does it: an upcoming game has no historical gameId to match against in
    the stats table. Instead, each team's *current* rolling average (through
    their most recent completed game, via _current_team_snapshot) is looked
    up by team name and carried forward onto whatever their next game is."""
    all_games = pd.DataFrame(ingest.ingest_games(season))
    if all_games.empty:
        return pd.DataFrame()
    fbs = (all_games["homeClassification"] == "fbs") & (all_games["awayClassification"] == "fbs")
    history_df = all_games[fbs & (all_games["completed"] == True)]  # noqa: E712
    target_df = all_games[fbs & (all_games["week"] == week) & (all_games["completed"] == False)]  # noqa: E712
    if target_df.empty:
        return pd.DataFrame()

    team_stats = _team_game_stats_frame(season, history_df)
    snapshot = _current_team_snapshot(team_stats)

    talent = _talent_map(season)
    prev_sp = _sp_map(season - 1)
    closing_spread = _closing_spread_map(season)

    home_frame = _side_frame_upcoming(snapshot, talent, prev_sp, "home")
    away_frame = _side_frame_upcoming(snapshot, talent, prev_sp, "away")

    result = target_df.merge(home_frame, on="homeTeam", how="left")
    result = result.merge(away_frame, on="awayTeam", how="left")

    result["closing_spread"] = result["id"].map(closing_spread)
    # utc=True keeps both sides tz-aware even when a team has no last_game_date
    # at all (an all-NaN column would otherwise infer as tz-naive and blow up
    # subtracting from the tz-aware startDate column).
    start_date = pd.to_datetime(result["startDate"], utc=True)
    result["home_rest_days"] = (start_date - pd.to_datetime(result["home_last_game_date"], utc=True)).dt.days
    result["away_rest_days"] = (start_date - pd.to_datetime(result["away_last_game_date"], utc=True)).dt.days

    result = result.rename(
        columns={
            "id": "game_id",
            "startDate": "start_date",
            "homeTeam": "home_team",
            "awayTeam": "away_team",
            "neutralSite": "neutral_site",
            "conferenceGame": "conference_game",
            "homePregameElo": "home_pregame_elo",
            "awayPregameElo": "away_pregame_elo",
        }
    )

    keep = (
        ["game_id", "season", "week", "start_date", "home_team", "away_team",
         "neutral_site", "conference_game", "home_pregame_elo", "away_pregame_elo",
         "closing_spread"]
        + [f"home_{c}" for c in ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]]
        + [f"away_{c}" for c in ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]]
    )
    return result[keep]


def build_features(start_season: int, end_season: int) -> pd.DataFrame:
    frames = [build_season_features(year) for year in range(start_season, end_season + 1)]
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True)


def add_model_features(df: pd.DataFrame) -> pd.DataFrame:
    """Adds elo_diff/*_diff columns (FEATURE_COLUMNS) on top of the raw
    home_*/away_* columns build_season_features / build_upcoming_features
    produce. Used both for the historical table (load_feature_table) and for
    live predictions (predict.py), so predict.py never needs to know these
    particular column names exist."""
    df = df.copy()
    df["elo_diff"] = df["home_pregame_elo"] - df["away_pregame_elo"]
    for base in DIFF_BASES:
        df[f"{base}_diff"] = df[f"home_{base}"] - df[f"away_{base}"]
    df["neutral_site"] = df["neutral_site"].astype(int)
    df["conference_game"] = df["conference_game"].astype(int)
    return df


def load_feature_table() -> pd.DataFrame:
    """Historical feature table with FEATURE_COLUMNS computed, for models.py
    / evaluate.py. Those modules never see off_ppa, sp_rating, etc. by name
    -- only whatever's listed in FEATURE_COLUMNS."""
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
