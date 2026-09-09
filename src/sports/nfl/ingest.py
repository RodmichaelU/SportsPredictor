"""NFL data via nflreadpy (nflverse). No API key and no rate limit -- it
downloads released data files from GitHub and caches them itself, so unlike
CFBD there's no need for our own data/raw/ caching layer here.

Run: python -m src.sports.nfl.ingest [--start YEAR] [--end YEAR]
"""

import argparse

import nflreadpy as nfl
import pandas as pd
import requests

import config

ET = "America/New_York"  # nflverse lists gametime in Eastern local time

SEASON_TYPE = "REG"

# Found by `python -m src.elo --sport nfl` (tuned on 2015-2024, tested on
# 2025: 65.1% accuracy vs. 53.7% naive home baseline). Much lower than CFB's
# K=80/HFA=50 -- NFL has far more parity, so ratings should move less per
# game and home field matters less.
ELO_K = 40
ELO_HOME_ADVANTAGE = 25


def ingest_schedules(start_season: int, end_season: int) -> pd.DataFrame:
    df = nfl.load_schedules(seasons=list(range(start_season, end_season + 1))).to_pandas()
    df["kickoff"] = kickoff_timestamp(df)
    return df


def kickoff_timestamp(sched: pd.DataFrame) -> pd.Series:
    """gameday ("2026-09-09") + gametime ("20:20", Eastern local) as a proper
    UTC ISO timestamp. gameday alone is a date with no time, which is fine
    for day-level sorting but renders a day off in the frontend for anyone
    west of UTC (midnight UTC on the 9th is evening of the 8th in US time
    zones) -- combining both avoids that."""
    naive = pd.to_datetime(
        sched["gameday"] + " " + sched["gametime"].fillna("13:00"), format="%Y-%m-%d %H:%M"
    )
    return naive.dt.tz_localize(ET, ambiguous="NaT", nonexistent="shift_forward").dt.tz_convert("UTC")


def ingest_team_stats(start_season: int, end_season: int) -> pd.DataFrame:
    """A season with zero games played yet (e.g. predicting week 1 before
    any results exist) has no stats_team_week_<year>.parquet file published
    on nflverse yet -- that 404s the whole multi-season request, so seasons
    are fetched one at a time and a not-yet-published one is simply skipped
    (its games will all correctly show up as "no prior data" this way)."""
    frames = []
    for year in range(start_season, end_season + 1):
        try:
            frames.append(nfl.load_team_stats(seasons=[year], summary_level="week").to_pandas())
        except (requests.exceptions.HTTPError, ConnectionError):
            continue
    if not frames:
        return pd.DataFrame(columns=["season", "week", "team", "season_type", "game_id", "opponent_team"])
    df = pd.concat(frames, ignore_index=True)
    return df[df["season_type"] == SEASON_TYPE]


def load_games(start_season: int, end_season: int) -> pd.DataFrame:
    """Common schema for elo.py/reconcile.py: completed regular-season games
    only, one row per game, sorted chronologically."""
    sched = ingest_schedules(start_season, end_season)
    sched = sched[sched["game_type"] == SEASON_TYPE]
    completed = sched.dropna(subset=["home_score", "away_score"])

    df = pd.DataFrame(
        {
            "game_id": completed["game_id"],
            "season": completed["season"],
            "week": completed["week"],
            "start_date": completed["kickoff"].astype(str),
            "home_team": completed["home_team"],
            "away_team": completed["away_team"],
            "neutral_site": completed["location"] == "Neutral",
            "home_points": completed["home_score"],
            "away_points": completed["away_score"],
        }
    )
    df["home_win"] = (df["home_points"] > df["away_points"]).astype(int)
    return df.sort_values(["season", "start_date"]).reset_index(drop=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    sched = ingest_schedules(args.start, args.end)
    stats = ingest_team_stats(args.start, args.end)
    print(f"{args.start}-{args.end}: {len(sched)} scheduled games, {len(stats)} team-game stat rows")


if __name__ == "__main__":
    main()
