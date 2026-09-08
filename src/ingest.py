"""Pull games, per-game team stats, talent, SP+ ratings, and betting lines
for a range of seasons into data/raw (via cfbd_client's disk cache).

Per-game stats (not season-aggregate totals) are pulled deliberately: Phase 2
builds season-to-date rolling features from these, and a season-aggregate
total would include the target game itself, which is data leakage.

Run: python -m src.ingest [--start YEAR] [--end YEAR]
"""

import argparse

import config
from src import cfbd_client

SEASON_TYPE = "regular"


def ingest_games(year: int) -> list:
    return cfbd_client.get(
        "/games", {"year": year, "seasonType": SEASON_TYPE, "classification": config.DIVISION}
    )


def ingest_lines(year: int) -> list:
    return cfbd_client.get(
        "/lines", {"year": year, "seasonType": SEASON_TYPE, "classification": config.DIVISION}
    )


def ingest_game_stats(year: int) -> list:
    return cfbd_client.get("/stats/game/advanced", {"year": year, "seasonType": SEASON_TYPE})


def ingest_talent(year: int) -> list:
    return cfbd_client.get("/talent", {"year": year})


def ingest_sp_ratings(year: int) -> list:
    return cfbd_client.get("/ratings/sp", {"year": year})


def ingest_season(year: int) -> dict:
    return {
        "games": ingest_games(year),
        "lines": ingest_lines(year),
        "game_stats": ingest_game_stats(year),
        "talent": ingest_talent(year),
        "sp_ratings": ingest_sp_ratings(year),
    }


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
