"""NHL data via the official NHL web API (api-web.nhle.com/v1). No API key
required. This is the current, correct endpoint -- the older
statsapi.web.nhl.com is decommissioned; don't use it.

ARCHITECTURE-READY SCOPE: load_games() is real and tested (see
TUNED_K/TUNED_HOME_ADVANTAGE below). features.py is NOT built yet -- see
the TODO there.

Run: python -m src.sports.nhl.ingest [--start YEAR] [--end YEAR]
"""

import argparse

import pandas as pd
import requests

import config

BASE_URL = "https://api-web.nhle.com/v1"

# The 32 current NHL team abbreviations (confirmed live via
# GET /v1/standings/<date>). No stable "list all teams" endpoint was found
# during this pass, so this is a maintained list rather than fetched --
# revisit if a team is added/relocated/renamed.
TEAMS = [
    "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET",
    "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT",
    "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK",
    "WPG", "WSH",
]

REGULAR_SEASON_GAME_TYPE = 2

# Found by `python -m src.elo --sport nhl --start 2022 --end 2024
# --test-season 2024` (tuned on 2022-2023, a small validation range -- not
# the full historical depth CFB/NFL were tuned on). Confirmed K=10 is a real
# optimum, not a grid-boundary artifact, by sweeping down to K=1 separately.
# Only 58.5% accuracy on the held-out 2024 season vs. a 56.3% naive
# home-favorite baseline -- a much smaller edge than NBA/CFB/NFL show,
# consistent with hockey's outcomes being genuinely harder to predict from
# team strength alone (high game-to-game variance). Re-tune once a fuller
# range has been ingested for real.
ELO_K = 10
ELO_HOME_ADVANTAGE = 25


def _season_code(start_year: int) -> str:
    """NHL's season format: the season starting in `start_year` is written
    like 20252026 (both years concatenated, no separator)."""
    return f"{start_year}{start_year + 1}"


def ingest_team_season_schedule(team: str, start_year: int) -> list[dict]:
    response = requests.get(
        f"{BASE_URL}/club-schedule-season/{team}/{_season_code(start_year)}", timeout=20
    )
    if response.status_code == 404:
        return []  # team didn't exist yet / season not published
    response.raise_for_status()
    return response.json().get("games", [])


def load_games(start_season: int, end_season: int) -> pd.DataFrame:
    """Common schema for elo.py: one row per completed regular-season game.
    Each team's full-season schedule is fetched once (32 calls/season,
    rather than paging week by week through the whole league); every game
    appears in two teams' schedules, deduplicated here by game id."""
    games_by_id: dict[int, dict] = {}
    for year in range(start_season, end_season + 1):
        for team in TEAMS:
            for g in ingest_team_season_schedule(team, year):
                if g.get("gameType") != REGULAR_SEASON_GAME_TYPE:
                    continue
                if g.get("gameState") not in ("OFF", "FINAL"):
                    continue  # not yet played
                games_by_id[g["id"]] = {
                    "game_id": g["id"],
                    "season": year,
                    "week": 0,  # see the same note in src/sports/nba/ingest.py
                    "start_date": g["startTimeUTC"],
                    "home_team": g["homeTeam"]["abbrev"],
                    "away_team": g["awayTeam"]["abbrev"],
                    "neutral_site": bool(g.get("neutralSite", False)),
                    "home_points": g["homeTeam"]["score"],
                    "away_points": g["awayTeam"]["score"],
                }

    df = pd.DataFrame(games_by_id.values())
    if df.empty:
        return df
    df["home_win"] = (df["home_points"] > df["away_points"]).astype(int)
    return df.sort_values(["season", "start_date"]).reset_index(drop=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    games = load_games(args.start, args.end)
    print(f"{args.start}-{args.end}: {len(games)} completed games")


if __name__ == "__main__":
    main()
