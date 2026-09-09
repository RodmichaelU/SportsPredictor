"""Pull games, per-game team stats, talent, SP+ ratings, and betting lines
for a range of seasons into data/raw (via client's disk cache).

Per-game stats (not season-aggregate totals) are pulled deliberately: Phase 2
builds season-to-date rolling features from these, and a season-aggregate
total would include the target game itself, which is data leakage.

Run: python -m src.sports.cfb.ingest [--start YEAR] [--end YEAR]
"""

import argparse

import pandas as pd

import config
from src.sports.cfb import client

SEASON_TYPE = "regular"


def ingest_games(year: int) -> list:
    return client.get(
        "/games", {"year": year, "seasonType": SEASON_TYPE, "classification": config.DIVISION}
    )


def ingest_lines(year: int) -> list:
    return client.get(
        "/lines", {"year": year, "seasonType": SEASON_TYPE, "classification": config.DIVISION}
    )


def ingest_game_stats(year: int) -> list:
    return client.get("/stats/game/advanced", {"year": year, "seasonType": SEASON_TYPE})


def ingest_talent(year: int) -> list:
    return client.get("/talent", {"year": year})


def ingest_sp_ratings(year: int) -> list:
    return client.get("/ratings/sp", {"year": year})


def ingest_season(year: int) -> dict:
    return {
        "games": ingest_games(year),
        "lines": ingest_lines(year),
        "game_stats": ingest_game_stats(year),
        "talent": ingest_talent(year),
        "sp_ratings": ingest_sp_ratings(year),
    }


def load_games(start_season: int, end_season: int) -> pd.DataFrame:
    """Common schema for elo.py: completed FBS-vs-FBS games only, one row
    per game, sorted chronologically."""
    rows = []
    for year in range(start_season, end_season + 1):
        for g in ingest_games(year):
            if not g["completed"]:
                continue
            if g["homeClassification"] != "fbs" or g["awayClassification"] != "fbs":
                continue
            rows.append(
                {
                    "game_id": g["id"],
                    "season": g["season"],
                    "week": g["week"],
                    "start_date": g["startDate"],
                    "home_team": g["homeTeam"],
                    "away_team": g["awayTeam"],
                    "neutral_site": g["neutralSite"],
                    "home_points": g["homePoints"],
                    "away_points": g["awayPoints"],
                }
            )
    df = pd.DataFrame(rows)
    df["home_win"] = (df["home_points"] > df["away_points"]).astype(int)
    return df.sort_values(["season", "start_date"]).reset_index(drop=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    for year in range(args.start, args.end + 1):
        result = ingest_season(year)
        counts = {k: len(v) for k, v in result.items()}
        print(f"{year}: {counts}")


if __name__ == "__main__":
    main()
