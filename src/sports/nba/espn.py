"""The in-progress NBA season from ESPN's public site API (free, no key),
reshaped into exactly the stats.nba.com tables ingest.py caches, so
features.py and everything downstream can't tell the difference.

Why: stats.nba.com blocks or stalls requests from cloud hosts, including
GitHub's runners, where the site is refreshed. Finished seasons don't need
it -- their stats.nba.com tables ship in data/history/nba/ -- so only the
current season comes from here.

Two endpoints:
  - scoreboard?dates=YYYYMM: every game in a month (a date *range* isn't
    supported), with status, tip time, scores and neutral-site flag. Nine
    calls cover a season's schedule.
  - summary?event=ID: one game's box score, player by player. Called once
    per finished game; a final box score never changes, so it's cached for
    good.

Matching back to stats.nba.com's identifiers, so a season's ids stay
consistent with the frozen predictions already stored against them:
  - team codes: ESPN differs on six (TEAM_CODES).
  - game ids: looked up in the NBA's own schedule for the season, shipped in
    data/history/nba/ (by date and teams, then by teams alone for a
    rescheduled game). A game the NBA schedule didn't list gets "E<espn id>".
  - player ids: by normalized name against earlier seasons' box scores (the
    same normalization the injury report uses), since features.py values a
    player across this season and last. Unmatched (rookies) or ambiguous
    names get the negated ESPN athlete id.

Cached under data/raw/nba/espn/: month scoreboards (permanent once every
game in a finished month is final, else IN_PROGRESS_TTL) and the box score
part of each final game's summary, gzipped -- the full response is mostly
play-by-play (~440 KB) that nothing here uses.

Run: python -m src.sports.nba.espn --validate 2025
     (rebuilds a finished season from ESPN and compares it with the
     stats.nba.com tables: games, scores, player stats, model features)
"""

import argparse
import gzip
import json
import time
import zlib
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

from src.sports.nba import ingest

BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
ESPN_DIR = ingest.RAW_NBA_DIR / "espn"

# ESPN abbreviation -> stats.nba.com tricode, where they differ.
TEAM_CODES = {"GS": "GSW", "NY": "NYK", "NO": "NOP", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS"}

# Regular season (season type 2), standard games only: drops the NBA Cup
# final ("CC", which doesn't count toward standings) and All-Star games.
REGULAR_SEASON_TYPE, STANDARD_GAME = 2, "STD"

REQUEST_PAUSE = 0.2  # seconds between uncached calls; ESPN publishes no limit, so be polite


def _team(abbreviation: str) -> str:
    return TEAM_CODES.get(abbreviation, abbreviation)


def _get(endpoint: str, **params) -> dict:
    response = requests.get(f"{BASE_URL}/{endpoint}", params=params, timeout=30)
    response.raise_for_status()
    time.sleep(REQUEST_PAUSE)
    return response.json()


def _read(path: Path) -> dict:
    with gzip.open(path, "rt") as f:
        return json.load(f)


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt") as f:
        json.dump(data, f)


def _season_months(season: int) -> list[str]:
    """October through June: opening night to the end of the playoffs."""
    return [f"{season}{m:02d}" for m in (10, 11, 12)] + [f"{season + 1}{m:02d}" for m in range(1, 7)]


def _month_is_settled(month: str, events: list[dict]) -> bool:
    year, m = int(month[:4]), int(month[4:])
    month_end = datetime(year + (m == 12), m % 12 + 1, 1, tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > month_end and all(e["status"]["type"]["state"] == "post" for e in events)


def _scoreboard(month: str, cache_dir: Path) -> list[dict]:
    path = cache_dir / f"scoreboard_{month}.json.gz"
    if path.exists():
        cached = _read(path)
        written = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        if cached.get("settled") or datetime.now(timezone.utc) - written < ingest.IN_PROGRESS_TTL:
            return cached["events"]
    events = _get("scoreboard", dates=month, limit=1000).get("events", [])
    _write(path, {"events": events, "settled": _month_is_settled(month, events)})
    return events


def season_events(season: int, cache_dir: Path = ESPN_DIR) -> pd.DataFrame:
    """Every regular-season game ESPN lists for the season starting in
    `season`, one row per game, ESPN's identifiers."""
    rows = {}
    for month in _season_months(season):
        for e in _scoreboard(month, cache_dir):
            comp = e["competitions"][0]
            if e["season"]["type"] != REGULAR_SEASON_TYPE or comp["type"].get("abbreviation") != STANDARD_GAME:
                continue
            sides = {c["homeAway"]: c for c in comp["competitors"]}
            if any(c["team"]["abbreviation"] == "TBD" for c in sides.values()):
                continue  # an NBA Cup knockout game before its teams are decided
            status = e["status"]["type"]
            tip = pd.Timestamp(e["date"])
            rows[e["id"]] = {
                "espn_id": e["id"],
                "start_utc": tip,
                "game_date": tip.tz_convert(ingest.ET).strftime("%Y-%m-%d"),
                "home_team": _team(sides["home"]["team"]["abbreviation"]),
                "away_team": _team(sides["away"]["team"]["abbreviation"]),
                "home_points": pd.to_numeric(sides["home"].get("score"), errors="coerce"),
                "away_points": pd.to_numeric(sides["away"].get("score"), errors="coerce"),
                "final": status["name"] == "STATUS_FINAL",
                "live": status["state"] == "in",
                "postponed": status["name"] == "STATUS_POSTPONED",
                "canceled": status["name"] == "STATUS_CANCELED",
                "neutral_site": bool(comp.get("neutralSite")),
            }
    events = pd.DataFrame(rows.values())
    return events[~events["canceled"]].sort_values("start_utc").reset_index(drop=True) if len(events) else events


def _nba_schedule(season: int) -> pd.DataFrame:
    """The NBA's own regular-season schedule for `season`, if one shipped."""
    path = ingest.HISTORY_DIR / f"schedule_{season}.parquet"
    if not path.exists():
        return pd.DataFrame(columns=["gameId", "game_date", "home", "away"])
    raw = pd.read_parquet(path)
    raw = raw[raw["gameId"].str.startswith(ingest.REGULAR_SEASON_PREFIX)]
    return pd.DataFrame(
        {"gameId": raw["gameId"], "game_date": raw["gameDateEst"].str[:10],
         "home": raw["homeTeam_teamTricode"], "away": raw["awayTeam_teamTricode"]}
    )


def game_ids(events: pd.DataFrame, season: int) -> pd.Series:
    """stats.nba.com game id for each ESPN event (see the module docstring)."""
    nba = _nba_schedule(season)
    by_date = {(r.game_date, r.home, r.away): r.gameId for r in nba.itertuples()}
    by_pair: dict[tuple, list] = {}
    for r in nba.itertuples():
        by_pair.setdefault((r.home, r.away), []).append((r.game_date, r.gameId))

    ids, used = {}, set()
    for e in events.itertuples():
        gid = by_date.get((e.game_date, e.home_team, e.away_team))
        if gid:
            ids[e.Index] = gid
            used.add(gid)
    # Rescheduled games: same matchup, nearest still-unclaimed date.
    for e in events.itertuples():
        if e.Index in ids:
            continue
        options = [(abs(pd.Timestamp(d) - pd.Timestamp(e.game_date)), gid)
                   for d, gid in by_pair.get((e.home_team, e.away_team), []) if gid not in used]
        if options:
            gid = min(options)[1]
            ids[e.Index] = gid
            used.add(gid)
        else:
            ids[e.Index] = f"E{e.espn_id}"
    return pd.Series(ids).reindex(events.index)


def schedule(season: int, cache_dir: Path = ESPN_DIR) -> pd.DataFrame:
    """ScheduleLeagueV2's shape (the columns ingest.ingest_schedule reads)."""
    events = season_events(season, cache_dir)
    tip = events["start_utc"].dt.tz_convert("UTC")
    return pd.DataFrame(
        {
            "gameId": game_ids(events, season),
            "gameStatus": events["final"].map({True: 3, False: 1}).where(~events["live"], 2),
            "gameDateEst": events["game_date"] + "T00:00:00Z",
            "gameDateTimeUTC": tip.dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "isNeutral": events["neutral_site"],
            "postponedStatus": events["postponed"].map({True: "Y", False: "N"}),
            "homeTeam_teamTricode": events["home_team"],
            "awayTeam_teamTricode": events["away_team"],
        }
    )


def team_games(season: int, cache_dir: Path = ESPN_DIR) -> pd.DataFrame:
    """LeagueGameFinder's shape, completed games only: two rows per game, the
    columns ingest.load_games reads."""
    events = season_events(season, cache_dir)
    events = events.assign(game_id=game_ids(events, season))[events["final"]]
    rows = []
    for e in events.itertuples():
        for team, opp, pts, opp_pts, matchup in (
            (e.home_team, e.away_team, e.home_points, e.away_points, f"{e.home_team} vs. {e.away_team}"),
            (e.away_team, e.home_team, e.away_points, e.home_points, f"{e.away_team} @ {e.home_team}"),
        ):
            rows.append({"TEAM_ABBREVIATION": team, "GAME_ID": e.game_id, "GAME_DATE": e.game_date,
                         "MATCHUP": matchup, "WL": "W" if pts > opp_pts else "L", "PTS": int(pts)})
    return pd.DataFrame(rows, columns=["TEAM_ABBREVIATION", "GAME_ID", "GAME_DATE", "MATCHUP", "WL", "PTS"])


def _box_score(espn_id: str, cache_dir: Path) -> dict:
    path = cache_dir / "summary" / f"{espn_id}.json.gz"
    if path.exists():
        return _read(path)
    summary = _get("summary", event=espn_id)
    box = {"boxscore": summary.get("boxscore", {})}
    _write(path, box)  # only called for final games, so this never goes stale
    return box


def _made_attempted(value: str) -> tuple[int, int]:
    made, _, attempted = value.partition("-")
    return int(made or 0), int(attempted or 0)


def _count(stats: dict, key: str) -> int:
    """A box score count; "--" (no minutes logged) and blanks are 0."""
    value = pd.to_numeric(stats.get(key), errors="coerce")
    return 0 if pd.isna(value) else int(value)


def _player_ids(season: int) -> dict[str, int]:
    """normalized name -> stats.nba.com player id, from the two seasons
    before `season` (most recent wins). Names shared by two players map to
    nothing, so neither borrows the other's history."""
    ids: dict[str, int] = {}
    ambiguous = set()
    for year in (season - 2, season - 1):
        path = ingest.HISTORY_DIR / f"player_games_{year}.parquet"
        if not path.exists():
            continue
        players = pd.read_parquet(path, columns=["PLAYER_ID", "PLAYER_NAME"]).drop_duplicates()
        season_ids: dict[str, set] = {}
        for p in players.itertuples():
            season_ids.setdefault(ingest.normalize_player_name(p.PLAYER_NAME), set()).add(int(p.PLAYER_ID))
        for name, found in season_ids.items():
            if len(found) > 1:
                ambiguous.add(name)
            else:
                ids[name] = found.pop()
    return {name: pid for name, pid in ids.items() if name not in ambiguous}


PLAYER_COLUMNS = ["PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GAME_ID", "GAME_DATE", "MIN",
                  "PTS", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB",
                  "AST", "STL", "BLK", "TOV", "PF"]


def player_games(season: int, cache_dir: Path = ESPN_DIR) -> pd.DataFrame:
    """LeagueGameLog's (player mode) shape: one row per player per completed
    game *played* -- like stats.nba.com, players who sat have no row."""
    events = season_events(season, cache_dir)
    events = events.assign(game_id=game_ids(events, season))[events["final"]]
    known = _player_ids(season)
    rows = []
    for e in events.itertuples():
        for side in _box_score(e.espn_id, cache_dir)["boxscore"].get("players", []):
            team = _team(side["team"]["abbreviation"])
            for block in side.get("statistics", []):
                labels = block.get("names") or block.get("keys") or []
                for a in block.get("athletes", []):
                    if a.get("didNotPlay") or not a.get("stats"):
                        continue
                    s = dict(zip(labels, a["stats"]))
                    if s.get("MIN") == "--":  # listed but never got in ("0" is seconds played): stats.nba.com has no row either
                        continue
                    athlete = a["athlete"]
                    # Rarely (a two-way call-up) ESPN gives only a short name and no id.
                    name = athlete.get("displayName") or athlete.get("shortName", "")
                    fallback_id = -int(athlete["id"]) if athlete.get("id") else -zlib.crc32(name.encode())
                    fgm, fga = _made_attempted(s.get("FG", "0-0"))
                    fg3m, fg3a = _made_attempted(s.get("3PT", "0-0"))
                    ftm, fta = _made_attempted(s.get("FT", "0-0"))
                    rows.append({
                        "PLAYER_ID": known.get(ingest.normalize_player_name(name), fallback_id),
                        "PLAYER_NAME": name, "TEAM_ABBREVIATION": team, "GAME_ID": e.game_id,
                        "GAME_DATE": e.game_date, "MIN": _count(s, "MIN"), "PTS": _count(s, "PTS"),
                        "FGM": fgm, "FGA": fga, "FG3M": fg3m, "FG3A": fg3a, "FTM": ftm, "FTA": fta,
                        "OREB": _count(s, "OREB"), "DREB": _count(s, "DREB"), "REB": _count(s, "REB"), "AST": _count(s, "AST"),
                        "STL": _count(s, "STL"), "BLK": _count(s, "BLK"), "TOV": _count(s, "TO"), "PF": _count(s, "PF"),
                    })
    return pd.DataFrame(rows, columns=PLAYER_COLUMNS)


def validate(season: int, cache_dir: Path) -> None:
    """Rebuild a finished season from ESPN and compare it with that season's
    stats.nba.com tables, down to the model's inputs."""
    nba_games = pd.read_parquet(ingest.HISTORY_DIR / f"team_games_{season}.parquet")
    nba_games = nba_games[nba_games["WL"].notna()]
    espn_games = team_games(season, cache_dir)
    nba_ids, espn_ids = set(nba_games["GAME_ID"]), set(espn_games["GAME_ID"])
    print(f"games: stats.nba.com {len(nba_ids)}, ESPN {len(espn_ids)}, matched {len(nba_ids & espn_ids)}")
    for gid in sorted(espn_ids - nba_ids):
        print("  ESPN only:", espn_games[espn_games["GAME_ID"] == gid][["GAME_DATE", "MATCHUP", "PTS"]].values.tolist())
    for gid in sorted(nba_ids - espn_ids):
        print("  stats.nba.com only:", nba_games[nba_games["GAME_ID"] == gid][["GAME_DATE", "MATCHUP", "PTS"]].values.tolist())

    key = ["GAME_ID", "TEAM_ABBREVIATION"]
    scores = nba_games[key + ["PTS", "GAME_DATE"]].merge(espn_games[key + ["PTS", "GAME_DATE"]], on=key, suffixes=("_nba", "_espn"))
    print(f"team scores differing: {(scores['PTS_nba'] != scores['PTS_espn']).sum()} of {len(scores)}; "
          f"dates differing: {(scores['GAME_DATE_nba'] != scores['GAME_DATE_espn']).sum()}")

    nba_players = pd.read_parquet(ingest.HISTORY_DIR / f"player_games_{season}.parquet")
    espn_players = player_games(season, cache_dir)
    eff = lambda p: p["PTS"] + p["REB"] + p["AST"] + p["STL"] + p["BLK"] - (p["FGA"] - p["FGM"]) - (p["FTA"] - p["FTM"]) - p["TOV"]  # noqa: E731
    pkey = ["GAME_ID", "PLAYER_ID"]
    both = nba_players.assign(eff=eff(nba_players))[pkey + ["eff"]].merge(
        espn_players.assign(eff=eff(espn_players))[pkey + ["eff"]], on=pkey, how="outer", suffixes=("_nba", "_espn"), indicator=True
    )
    both = both[both["GAME_ID"].isin(nba_ids & espn_ids)]
    matched = both[both["_merge"] == "both"]
    print(f"player rows: stats.nba.com {(both['_merge'] != 'right_only').sum()}, ESPN {(both['_merge'] != 'left_only').sum()}, "
          f"matched by id {len(matched)}; value (EFF) differing: {(matched['eff_nba'] != matched['eff_espn']).sum()}")

    # The model's inputs for every game, built both ways.
    from src.sports.nba import features

    def build(source: str) -> pd.DataFrame:
        original = (ingest.ingest_season_games, ingest.ingest_player_games, ingest.ingest_schedule)
        if source == "espn":
            ingest.ingest_season_games = lambda y, f=original[0]: team_games(y, cache_dir) if y == season else f(y)
            ingest.ingest_player_games = lambda y, f=original[1]: player_games(y, cache_dir) if y == season else f(y)
            ingest.ingest_schedule = lambda y, f=original[2]: ingest._schedule_frame(schedule(y, cache_dir), y) if y == season else f(y)
        try:
            return features.add_model_features(features.build_season_features(season)).set_index("game_id")
        finally:
            ingest.ingest_season_games, ingest.ingest_player_games, ingest.ingest_schedule = original

    a, b = build("nba"), build("espn")
    common = a.index.intersection(b.index)
    print(f"feature rows: stats.nba.com {len(a)}, ESPN {len(b)}, matched {len(common)}")
    for col in features.FEATURE_COLUMNS:
        diff = (a.loc[common, col] - b.loc[common, col]).abs()
        print(f"  {col:24s} games differing {int((diff > 1e-9).sum()):5d}   max diff {diff.max():.4f}")

    # The live model, trained on the seasons before this one (as it would
    # have been while the season was being predicted).
    from src import models
    history = features.load_feature_table()
    history = history[history["season"] < season]
    logistic = models.fit_logistic(history[features.FEATURE_COLUMNS], history["home_win"])
    pa = pd.Series(logistic.predict_proba(a.loc[common, features.FEATURE_COLUMNS])[:, 1], index=common)
    pb = pd.Series(logistic.predict_proba(b.loc[common, features.FEATURE_COLUMNS])[:, 1], index=common)
    diff = (pa - pb).abs()
    print(f"home win probability: mean diff {diff.mean():.4%}, max {diff.max():.4%}; "
          f"picks that flip: {int(((pa >= 0.5) != (pb >= 0.5)).sum())} of {len(common)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate", type=int, metavar="SEASON", required=True)
    parser.add_argument("--cache-dir", type=Path, default=ESPN_DIR / "validation")
    args = parser.parse_args()
    validate(args.validate, args.cache_dir)


if __name__ == "__main__":
    main()
