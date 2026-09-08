"""Build a one-row-per-game feature table with pre-game-only features.

Every rolling/season-to-date stat is computed with a strict week < target_week
filter within the same season (an expanding mean shifted by one game), so a
team's stats from the game being predicted, or any later game, never leak in.
Preseason inputs (talent composite, prior-season SP+, CFBD's own pregame Elo)
are safe to use as-is since they're fixed before the season/game starts.

Run: python -m src.features [--start YEAR] [--end YEAR]
"""

import argparse

import pandas as pd

import config
from src import ingest

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
        pd.to_datetime(df["start_date"]) - pd.to_datetime(df["prev_game_date"])
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


def build_season_features(season: int) -> pd.DataFrame:
    games_df = _games_frame(season)
    if games_df.empty:
        return pd.DataFrame()

    team_stats = _team_game_stats_frame(season, games_df)
    std = season_to_date_stats(team_stats)
    rest = _rest_days(team_stats)

    talent = _talent_map(season)
    prev_sp = _sp_map(season - 1)
    closing_spread = _closing_spread_map(season)

    home_frame = _side_frame(std, rest, talent, prev_sp, "home")
    away_frame = _side_frame(std, rest, talent, prev_sp, "away")

    result = games_df.merge(home_frame, on=["id", "homeTeam"], how="left")
    result = result.merge(away_frame, on=["id", "awayTeam"], how="left")

    result["closing_spread"] = result["id"].map(closing_spread)
    result["home_win"] = (result["homePoints"] > result["awayPoints"]).astype(int)
    result["margin"] = result["homePoints"] - result["awayPoints"]

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
         "closing_spread", "home_points", "away_points", "home_win", "margin"]
        + [f"home_{c}" for c in ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]]
        + [f"away_{c}" for c in ROLLING_STAT_COLUMNS + ["rest_days", "talent", "sp_rating", "sp_offense", "sp_defense"]]
    )
    return result[keep]


def build_features(start_season: int, end_season: int) -> pd.DataFrame:
    frames = [build_season_features(year) for year in range(start_season, end_season + 1)]
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    df = build_features(args.start, args.end)
    out_path = config.PROCESSED_DIR / "features.parquet"
    df.to_parquet(out_path, index=False)
    print(f"Wrote {len(df)} rows, {len(df.columns)} columns to {out_path}")


if __name__ == "__main__":
    main()
