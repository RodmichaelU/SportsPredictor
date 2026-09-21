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

# Found by `python -m src.elo --sport cfb` (tuned on 2015-2024, tested on
# 2025: 71.7% accuracy vs. 59.2% naive home baseline). Looked up by
# models.py / evaluate.py via this module rather than hardcoded, so each
# sport's Elo baseline uses its own tuned parameters.
ELO_K = 80
ELO_HOME_ADVANTAGE = 50


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


def ingest_teams() -> list:
    """Team metadata (logos, colors) -- not season-scoped like the rest of
    this module, so it's cached once under one key rather than busted by
    refresh.py's current-season cache-busting (a school's logo doesn't
    change week to week the way rosters and stats do)."""
    return client.get("/teams", {})


def team_logos() -> dict:
    """school name -> logo URL, for every team CFBD has at least one logo
    for. Keyed by the same "school" string load_games() uses for
    home_team/away_team, so it's a direct lookup with no name matching."""
    return {t["school"]: t["logos"][0] for t in ingest_teams() if t.get("logos")}


def standings(season: int) -> list[dict]:
    """Win-loss record per FBS team this season, with conference (for
    grouping). Derived from load_games() rather than CFBD's own /records
    endpoint, so it's consistent with every other win/loss count this app
    shows and costs no extra CFBD calls beyond ingest_teams(), already
    cached by team_logos().

    /teams has 57 duplicate school names once every classification and
    historical entry is included (e.g. multiple unrelated schools named
    "Albany") -- restricting to classification == "fbs" leaves exactly the
    138 current FBS teams with no collisions, so this is a safe direct
    lookup rather than fuzzy matching."""
    conference_by_team = {t["school"]: t.get("conference") for t in ingest_teams() if t.get("classification") == "fbs"}

    games = load_games(season, season)
    records: dict[str, dict] = {}
    for row in games.itertuples():
        for team, won in ((row.home_team, row.home_win == 1), (row.away_team, row.home_win == 0)):
            record = records.setdefault(
                team, {"team": team, "conference": conference_by_team.get(team), "wins": 0, "losses": 0}
            )
            record["wins" if won else "losses"] += 1
    return list(records.values())


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
