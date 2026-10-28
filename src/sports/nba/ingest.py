"""NBA data via nba_api (a wrapper around stats.nba.com) plus ESPN's public
injury feed. Both free, no API key.

Four raw sources, all confirmed live while building this:
  - LeagueGameFinder: one row per team per game (not one row per game like
    CFBD/nflreadpy/NHL), box score stats attached.
  - LeagueGameLog (player mode): one row per player per game *played* --
    a player who sat (injury, rest, DNP) simply has no row, which is how
    features.py detects historical absences.
  - ScheduleLeagueV2: the full season schedule including not-yet-played
    games and tip times, needed for upcoming predictions.
  - ESPN's site API injuries endpoint: the current injury report, for
    upcoming games only (there's no free historical archive of it -- see
    features.py for how training gets the equivalent signal instead).

Every stats.nba.com response is cached to data/raw/nba/ as parquet. A
season's cache is permanent once it was written after that season ended
(July 1 of the following year); an in-progress season's cache expires after
IN_PROGRESS_TTL so live predictions don't run on stale results. Every ESPN
injury pull is snapshotted to data/raw/nba/injuries/ so a frozen prediction
can always be traced back to the exact report it used.

Run: python -m src.sports.nba.ingest [--start YEAR] [--end YEAR]
"""

import argparse
import json
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests
from nba_api.stats.endpoints import leaguegamefinder, leaguegamelog, scheduleleaguev2
from nba_api.stats.static import teams as static_teams

import config

RAW_NBA_DIR = config.RAW_DIR / "nba"
INJURY_DIR = RAW_NBA_DIR / "injuries"
RAW_NBA_DIR.mkdir(parents=True, exist_ok=True)
INJURY_DIR.mkdir(parents=True, exist_ok=True)

IN_PROGRESS_TTL = timedelta(hours=1)
ESPN_INJURIES_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries"
ET = "America/New_York"

# Regular-season game ids start with "002" (001 = preseason, 004 = playoffs,
# 006 = the NBA Cup final, which doesn't count toward standings).
REGULAR_SEASON_PREFIX = "002"

# Found by `python -m src.elo --sport nba --start 2015 --end 2025
# --test-season 2025` (tuned on 2015-2024, tested on held-out 2025-26:
# 67.9% accuracy, log loss 0.607, vs. a 55.4% naive home-team baseline).
# Same constants an earlier 2022-2023-only tune found, so they're stable.
ELO_K = 20
ELO_HOME_ADVANTAGE = 50

# The 2020 restart bubble (Walt Disney World, from July 30, 2020): every
# game neutral despite nominal home/away in the box scores, and not flagged
# by ScheduleLeagueV2's isNeutral the way NBA Cup knockout games are.
BUBBLE_SEASON, BUBBLE_START = 2019, "2020-07-30"

CONFERENCES = {
    "Atlantic": "Eastern", "Central": "Eastern", "Southeast": "Eastern",
    "Northwest": "Western", "Pacific": "Western", "Southwest": "Western",
}
DIVISIONS = {
    "Atlantic": ["BOS", "BKN", "NYK", "PHI", "TOR"],
    "Central": ["CHI", "CLE", "DET", "IND", "MIL"],
    "Southeast": ["ATL", "CHA", "MIA", "ORL", "WAS"],
    "Northwest": ["DEN", "MIN", "OKC", "POR", "UTA"],
    "Pacific": ["GSW", "LAC", "LAL", "PHX", "SAC"],
    "Southwest": ["DAL", "HOU", "MEM", "NOP", "SAS"],
}
TEAM_DIVISION = {team: div for div, members in DIVISIONS.items() for team in members}


def _season_string(start_year: int) -> str:
    """nba_api's season format: the season starting in `start_year` is
    written like "2023-24" (last two digits of the following year)."""
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def _cache_path(name: str, season: int):
    return RAW_NBA_DIR / f"{name}_{season}.parquet"


def _cache_is_fresh(path, season: int) -> bool:
    if not path.exists():
        return False
    written = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    season_over = datetime(season + 1, 7, 1, tzinfo=timezone.utc)
    if written >= season_over:
        return True
    return datetime.now(timezone.utc) - written < IN_PROGRESS_TTL


def _with_retries(fetch, attempts: int = 3):
    """stats.nba.com intermittently times out under load -- retry with
    backoff rather than failing a whole multi-season build on one blip."""
    for attempt in range(attempts):
        try:
            return fetch()
        except (requests.exceptions.RequestException, ValueError):
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** (attempt + 1))


def _cached(name: str, season: int, fetch) -> pd.DataFrame:
    path = _cache_path(name, season)
    if _cache_is_fresh(path, season):
        return pd.read_parquet(path)
    df = _with_retries(fetch)
    df.to_parquet(path, index=False)
    return df


def bust_season_cache(season: int) -> int:
    """Delete one season's cached stats.nba.com responses, forcing a live
    re-pull next read -- what refresh.py uses for the in-progress season."""
    removed = 0
    for name in ("team_games", "player_games", "schedule"):
        path = _cache_path(name, season)
        if path.exists():
            path.unlink()
            removed += 1
    return removed


def ingest_season_games(start_year: int) -> pd.DataFrame:
    """Raw per-team-per-game rows for one season, box score stats included.
    Regular season only -- LeagueGameFinder defaults to every game type
    (preseason/regular/playoffs mixed together) without this filter, which
    inflates counts well past the real 1,230-game regular season."""
    def fetch():
        return leaguegamefinder.LeagueGameFinder(
            season_nullable=_season_string(start_year),
            league_id_nullable="00",
            season_type_nullable="Regular Season",
            timeout=60,
        ).get_data_frames()[0]

    return _cached("team_games", start_year, fetch)


def ingest_player_games(start_year: int) -> pd.DataFrame:
    """One row per player per regular-season game they actually played in."""
    def fetch():
        return leaguegamelog.LeagueGameLog(
            season=_season_string(start_year),
            league_id="00",
            player_or_team_abbreviation="P",
            season_type_all_star="Regular Season",
            timeout=60,
        ).get_data_frames()[0]

    return _cached("player_games", start_year, fetch)


def _week_numbers(game_dates: pd.Series) -> pd.Series:
    """The NBA's own week numbering: Monday-to-Sunday (Eastern) weeks, week 1
    being the (partial) week containing opening night. Derived from dates
    rather than read from ScheduleLeagueV2's weekNumber because that field
    is 0 for older seasons -- checked against it on 2020-21, 2024-25 and
    2026-27, where it's populated, and matched on every game."""
    dates = pd.to_datetime(game_dates)
    monday = dates - pd.to_timedelta(dates.dt.weekday, unit="D")
    return ((monday - monday.min()).dt.days // 7 + 1).astype(int)


def ingest_schedule(start_year: int) -> pd.DataFrame:
    """Regular-season schedule, one row per game, played or not."""
    def fetch():
        raw = scheduleleaguev2.ScheduleLeagueV2(
            season=_season_string(start_year), league_id="00", timeout=60
        ).get_data_frames()[0]
        return raw[
            ["gameId", "gameStatus", "gameDateEst", "gameDateTimeUTC", "isNeutral",
             "postponedStatus", "homeTeam_teamTricode", "awayTeam_teamTricode"]
        ]

    raw = _cached("schedule", start_year, fetch)
    raw = raw[raw["gameId"].str.startswith(REGULAR_SEASON_PREFIX)]
    game_date = raw["gameDateEst"].str[:10]
    sched = pd.DataFrame(
        {
            "game_id": raw["gameId"],
            "season": start_year,
            "week": _week_numbers(game_date),
            "game_date": game_date,
            "start_date": pd.to_datetime(raw["gameDateTimeUTC"]).dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "home_team": raw["homeTeam_teamTricode"],
            "away_team": raw["awayTeam_teamTricode"],
            "neutral_site": raw["isNeutral"].astype(bool)
            | ((start_year == BUBBLE_SEASON) & (game_date >= BUBBLE_START)),
            "completed": raw["gameStatus"] == 3,
            "postponed": raw["postponedStatus"] == "Y",
        }
    )
    return sched.reset_index(drop=True)


def load_games(start_season: int, end_season: int) -> pd.DataFrame:
    """Common schema for elo.py/reconcile.py: one row per completed regular-
    season game. LeagueGameFinder gives two rows per game (one per team);
    paired up here via GAME_ID, with home/away read from the MATCHUP field
    ("vs." = home, "@" = away). Week, tip time and neutral-site flag come
    from the schedule; game_date (Eastern calendar date) is an extra column
    beyond the common schema, used by features.py's "strictly earlier date"
    joins."""
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
        sched = ingest_schedule(year).set_index("game_id")
        merged = merged.join(sched[["week", "game_date", "start_date", "neutral_site"]], how="left")
        frames.append(
            pd.DataFrame(
                {
                    "game_id": merged.index,
                    "season": year,
                    "week": merged["week"],
                    "game_date": merged["game_date"].fillna(merged["GAME_DATE_home"]),
                    "start_date": merged["start_date"].fillna(merged["GAME_DATE_home"]),
                    "home_team": merged["TEAM_ABBREVIATION_home"],
                    "away_team": merged["TEAM_ABBREVIATION_away"],
                    "neutral_site": merged["neutral_site"].fillna(False).astype(bool),
                    "home_points": merged["PTS_home"],
                    "away_points": merged["PTS_away"],
                }
            )
        )
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if df.empty:
        return df
    df["home_win"] = (df["home_points"] > df["away_points"]).astype(int)
    return df.sort_values(["season", "start_date", "game_id"]).reset_index(drop=True)


def normalize_player_name(name: str) -> str:
    """For matching ESPN's injury-report names against stats.nba.com's:
    accents, punctuation and generational suffixes differ between the two
    ("Nikola Jokić" / "Nikola Jokic", "Jaren Jackson Jr." / "Jaren Jackson")."""
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    name = re.sub(r"[.'’]", "", name).replace("-", " ")
    words = [w for w in name.split() if w not in {"jr", "sr", "ii", "iii", "iv"}]
    return " ".join(words)


def _espn_team_to_code() -> dict:
    """ESPN's injury feed names teams in full ("LA Clippers"), not by code.
    Matched on nickname, since the city half differs between sources
    ("LA" vs. "Los Angeles") but the nickname never does."""
    return {t["nickname"]: t["abbreviation"] for t in static_teams.get_teams()}


_injury_memo: dict = {}


def fetch_injuries(max_age: timedelta = timedelta(minutes=10)) -> list[dict]:
    """Current injury report, one dict per listed player: team (our code),
    player, status ("Out" / "Day-To-Day"), comment, reported (ESPN's
    timestamp). Each live pull is snapshotted to data/raw/nba/injuries/;
    repeat calls within max_age reuse the same pull (a single predict run
    asks once per game slate, not once per game)."""
    now = datetime.now(timezone.utc)
    if _injury_memo and now - _injury_memo["at"] < max_age:
        return _injury_memo["rows"]

    response = requests.get(ESPN_INJURIES_URL, timeout=30)
    response.raise_for_status()
    payload = response.json()
    snapshot = INJURY_DIR / f"injuries_{now.strftime('%Y%m%dT%H%M%SZ')}.json"
    snapshot.write_text(json.dumps(payload))

    nickname_to_code = _espn_team_to_code()
    rows = []
    for team in payload.get("injuries", []):
        code = next((c for nick, c in nickname_to_code.items() if team["displayName"].endswith(nick)), None)
        if code is None:
            continue
        for injury in team.get("injuries", []):
            rows.append(
                {
                    "team": code,
                    "player": injury["athlete"]["displayName"],
                    "status": injury.get("status"),
                    "comment": injury.get("shortComment"),
                    "reported": injury.get("date"),
                }
            )
    _injury_memo.update({"at": now, "rows": rows})
    return rows


def team_logos() -> dict:
    """team code -> NBA's own CDN logo (free, keyed by stats.nba.com team id)."""
    return {
        t["abbreviation"]: f"https://cdn.nba.com/logos/nba/{t['id']}/global/L/logo.svg"
        for t in static_teams.get_teams()
    }


def standings(season: int) -> list[dict]:
    """Win-loss record per team this season, derived from load_games() so it
    always matches every other win/loss count the app shows."""
    games = load_games(season, season)
    records: dict[str, dict] = {}
    for row in games.itertuples():
        for team, won in ((row.home_team, row.home_win == 1), (row.away_team, row.home_win == 0)):
            division = TEAM_DIVISION.get(team)
            record = records.setdefault(
                team,
                {
                    "team": team,
                    "conference": f"{CONFERENCES[division]} Conference" if division else None,
                    "division": division,
                    "wins": 0,
                    "losses": 0,
                },
            )
            record["wins" if won else "losses"] += 1
    return list(records.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    for year in range(args.start, args.end + 1):
        team_rows = len(ingest_season_games(year))
        player_rows = len(ingest_player_games(year))
        sched_rows = len(ingest_schedule(year))
        print(f"{year}: {team_rows} team-game rows, {player_rows} player-game rows, {sched_rows} scheduled games")
    games = load_games(args.start, args.end)
    print(f"{args.start}-{args.end}: {len(games)} completed games")


if __name__ == "__main__":
    main()
