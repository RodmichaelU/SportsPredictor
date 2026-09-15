"""NBA data via nba_api (a wrapper around stats.nba.com). No API key
required. Confirmed live while building this: LeagueGameFinder returns one
row per team per game (not one row per game like CFBD/nflreadpy/NHL), with
box score stats already attached -- so the same call that gives us
load_games() will also give features.py everything it needs for rolling
team stats later, with no separate advanced-stats endpoint to find.

ARCHITECTURE-READY SCOPE: load_games() is real and tested (see
TUNED_K/TUNED_HOME_ADVANTAGE below, found by actually running `python -m
src.elo --sport nba`). features.py is NOT built yet -- see the TODO there.

Run: python -m src.sports.nba.ingest [--start YEAR] [--end YEAR]
"""

import argparse

import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder

import config

# Found by `python -m src.elo --sport nba --start 2022 --end 2024
# --test-season 2024` (tuned on 2022-2023, a small validation range -- not
# the full historical depth CFB/NFL were tuned on). 66.1% accuracy on the
# held-out 2024 season vs. a 54.5% naive home-favorite baseline. Re-tune
# once a fuller range has been ingested for real.
ELO_K = 20
ELO_HOME_ADVANTAGE = 50


def _season_string(start_year: int) -> str:
    """nba_api's season format: the season starting in `start_year` is
    written like "2023-24" (last two digits of the following year)."""
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def ingest_season_games(start_year: int) -> pd.DataFrame:
    """Raw per-team-per-game rows for one season, box score stats included.
    Regular season only -- LeagueGameFinder defaults to every game type
    (preseason/regular/playoffs mixed together) without this filter, which
    inflates counts well past the real 1,230-game regular season."""
    finder = leaguegamefinder.LeagueGameFinder(
        season_nullable=_season_string(start_year),
        league_id_nullable="00",
        season_type_nullable="Regular Season",
        timeout=30,
    )
    return finder.get_data_frames()[0]


def load_games(start_season: int, end_season: int) -> pd.DataFrame:
    """Common schema for elo.py: one row per completed regular-season game.
    LeagueGameFinder gives two rows per game (one per team); paired up here
    via GAME_ID, with home/away read from the MATCHUP field ("vs." = home,
    "@" = away)."""
    frames = []
    for year in range(start_season, end_season + 1):
        raw = ingest_season_games(year)
        raw = raw[raw["WL"].notna()].copy()  # completed games only
        raw["is_home"] = raw["MATCHUP"].str.contains(" vs. ")
        home = raw[raw["is_home"]].set_index("GAME_ID")
        away = raw[~raw["is_home"]].set_index("GAME_ID")
        merged = home.join(away, lsuffix="_home", rsuffix="_away", how="inner")
        if merged.empty:
            continue
        frames.append(
            pd.DataFrame(
                {
                    "game_id": merged.index,
                    "season": year,
                    # NBA games are date-scheduled, not organized into named
                    # weeks like CFB/NFL -- elo.py never reads this field
                    # (only start_date, for chronological order), but
                    # predict.py's --week CLI concept doesn't map cleanly
                    # here and needs a real design decision during the full
                    # build (e.g. group by date or by a synthetic week
                    # number), not a silent guess now.
                    "week": 0,
                    "start_date": merged["GAME_DATE_home"],
                    "home_team": merged["TEAM_ABBREVIATION_home"],
                    "away_team": merged["TEAM_ABBREVIATION_away"],
                    "neutral_site": False,  # not flagged by this endpoint; refine in the full build
                    "home_points": merged["PTS_home"],
                    "away_points": merged["PTS_away"],
                }
            )
        )
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
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
