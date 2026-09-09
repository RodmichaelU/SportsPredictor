"""Sport module registry: the one place that knows sport ids map to
src.sports.<id>.ingest / .features modules.

Every sport's ingest module must expose load_games(start, end) -> DataFrame
with columns: game_id, season, week, start_date, home_team, away_team,
neutral_site, home_points, away_points, home_win. elo.py, models.py, and
evaluate.py only ever touch that common schema, never a sport's raw fields.

Every sport's features module must expose:
  - FEATURE_COLUMNS: list[str] of numeric columns to train on
  - load_feature_table() -> DataFrame with FEATURE_COLUMNS plus season,
    week, game_id, home_win, margin
  - build_features(start, end) -> DataFrame (for the CLI that writes the
    processed parquet)
"""

import importlib

SPORTS = ["cfb", "nfl"]


def ingest_module(sport: str):
    return importlib.import_module(f"src.sports.{sport}.ingest")


def features_module(sport: str):
    return importlib.import_module(f"src.sports.{sport}.features")
