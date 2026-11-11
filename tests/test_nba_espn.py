"""ESPN -> stats.nba.com reshaping (src/sports/nba/espn.py), on a hand-built
month of ESPN responses: no network. The full-season comparison against
real stats.nba.com data is `python -m src.sports.nba.espn --validate 2025`."""

import pandas as pd
import pytest

from src.sports.nba import espn, ingest


def _event(espn_id, date, home, away, home_pts=None, away_pts=None, status="STATUS_FINAL",
           season_type=2, game_type="STD", neutral=False):
    state = {"STATUS_FINAL": "post", "STATUS_SCHEDULED": "pre"}.get(status, "pre")
    return {
        "id": espn_id, "date": date, "season": {"type": season_type},
        "status": {"type": {"name": status, "state": state}},
        "competitions": [{
            "type": {"abbreviation": game_type}, "neutralSite": neutral,
            "competitors": [
                {"homeAway": "home", "team": {"abbreviation": home}, "score": home_pts},
                {"homeAway": "away", "team": {"abbreviation": away}, "score": away_pts},
            ],
        }],
    }


EVENTS = [
    _event("1", "2026-10-21T00:00Z", "GS", "NY", "110", "100"),           # 20 Oct Eastern
    _event("2", "2026-10-24T00:00Z", "BOS", "SA", "98", "101"),           # rescheduled from the 22nd
    _event("3", "2026-10-25T23:00Z", "LAL", "WSH", status="STATUS_SCHEDULED"),  # not in the NBA schedule
    _event("4", "2026-10-26T00:00Z", "UTAH", "NO", status="STATUS_SCHEDULED"),
    _event("5", "2026-12-17T01:30Z", "SA", "NY", "120", "110", game_type="CC"),  # Cup final
    _event("6", "2026-12-04T05:00Z", "TBD", "TBD", status="STATUS_SCHEDULED"),
    _event("7", "2026-10-05T00:00Z", "GS", "LAL", "90", "80", season_type=1),    # preseason
]

NBA_SCHEDULE = pd.DataFrame({
    "gameId": ["0022600001", "0022600002", "0022600004", "0012600001"],
    "gameDateEst": ["2026-10-20T00:00:00Z", "2026-10-22T00:00:00Z", "2026-10-25T00:00:00Z", "2026-10-04T00:00:00Z"],
    "homeTeam_teamTricode": ["GSW", "BOS", "UTA", "GSW"],
    "awayTeam_teamTricode": ["NYK", "SAS", "NOP", "LAL"],
})

BOX = {"boxscore": {"players": [{
    "team": {"abbreviation": "GS"},
    "statistics": [{
        "names": ["MIN", "PTS", "FG", "3PT", "FT", "REB", "AST", "TO", "STL", "BLK", "OREB", "DREB", "PF", "+/-"],
        "athletes": [
            {"athlete": {"id": "11", "displayName": "Stephen Curry"}, "stats": ["34", "30", "10-20", "6-12", "4-4", "5", "7", "3", "1", "0", "0", "5", "2", "+8"]},
            {"athlete": {"id": "12", "displayName": "Rookie Guy"}, "stats": ["0", "0", "0-1", "0-0", "0-0", "0", "0", "0", "0", "0", "0", "0", "0", "-2"]},
            {"athlete": {"id": "13", "displayName": "Bench Guy"}, "stats": ["--", "0", "0-0", "0-0", "0-0", "0", "0", "0", "0", "0", "0", "0", "0", "0"]},
            {"athlete": {"id": "14", "displayName": "Hurt Guy"}, "didNotPlay": True, "stats": []},
        ],
    }],
}]}}


@pytest.fixture
def fake_espn(tmp_path, monkeypatch):
    monkeypatch.setattr(espn, "_scoreboard", lambda month, cache_dir: EVENTS if month == "202610" else [])
    monkeypatch.setattr(espn, "_box_score", lambda espn_id, cache_dir: BOX if espn_id == "1" else {"boxscore": {}})
    monkeypatch.setattr(ingest, "HISTORY_DIR", tmp_path)
    NBA_SCHEDULE.to_parquet(tmp_path / "schedule_2026.parquet")
    pd.DataFrame({"PLAYER_ID": [201939], "PLAYER_NAME": ["Stephen Curry"]}).to_parquet(tmp_path / "player_games_2025.parquet")
    return tmp_path


def test_schedule_keeps_regular_season_and_maps_ids(fake_espn):
    sched = espn.schedule(2026, fake_espn)
    # Cup final, TBD knockout game and preseason dropped.
    assert list(sched["gameId"]) == ["0022600001", "0022600002", "E3", "0022600004"]
    # Team codes translated; the rescheduled game kept its NBA id and took ESPN's (new) date.
    assert list(sched["homeTeam_teamTricode"]) == ["GSW", "BOS", "LAL", "UTA"]
    assert list(sched["awayTeam_teamTricode"]) == ["NYK", "SAS", "WAS", "NOP"]
    assert sched.loc[1, "gameDateEst"] == "2026-10-23T00:00:00Z"
    assert list(sched["gameStatus"]) == [3, 3, 1, 1]
    # Reads back through the same path as a stats.nba.com schedule.
    frame = ingest._schedule_frame(sched, 2026)
    assert list(frame["completed"]) == [True, True, False, False]


def test_team_games_match_league_game_finder(fake_espn):
    games = espn.team_games(2026, fake_espn)
    assert len(games) == 4  # two finished games, two rows each
    first = games[games["GAME_ID"] == "0022600001"].set_index("TEAM_ABBREVIATION")
    assert first.loc["GSW", "MATCHUP"] == "GSW vs. NYK" and first.loc["NYK", "MATCHUP"] == "NYK @ GSW"
    assert ingest._matchup_home_team(first.loc["NYK", "MATCHUP"]) == "GSW"
    assert first.loc["GSW", "WL"] == "W" and first.loc["GSW", "PTS"] == 110
    assert first.loc["GSW", "GAME_DATE"] == "2026-10-20"  # Eastern date, not UTC


def test_player_games_only_players_who_got_in(fake_espn):
    players = espn.player_games(2026, fake_espn).set_index("PLAYER_NAME")
    # "--" (never got in) and DNP have no row; "0" (seconds played) does.
    assert set(players.index) == {"Stephen Curry", "Rookie Guy"}
    curry = players.loc["Stephen Curry"]
    assert curry["PLAYER_ID"] == 201939  # carried over from stats.nba.com by name
    assert (curry["FGM"], curry["FGA"], curry["FTM"], curry["FTA"], curry["TOV"]) == (10, 20, 4, 4, 3)
    assert players.loc["Rookie Guy", "PLAYER_ID"] == -12  # no history: ESPN's id, negated
