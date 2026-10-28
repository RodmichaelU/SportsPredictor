"""Fails if any pre-game feature uses data from the target game or a later
one. Same discipline as test_leakage_cfb.py / test_leakage_nfl.py: recompute
each feature by hand from strictly earlier games and require an exact match.

The one deliberate exception is documented in src/sports/nba/features.py:
historical absences are read from the target game's box score, but only
*who played* (public pre-tip via the inactive list), never any stat from
it. test_missing_players_* pins that down: missing players are valued only
from earlier games, and nobody who actually played is ever counted missing.

Reads the cached data/raw/nba/ parquet files, so this makes no network
calls once `python -m src.sports.nba.ingest` has been run."""

import math
from functools import lru_cache

import pandas as pd

from src import elo
from src.sports.nba import features, ingest

TEST_SEASON = 2023


def _is_close(a, b, tol=1e-9):
    return math.isclose(a, b, rel_tol=tol, abs_tol=tol)


@lru_cache(maxsize=1)
def _season_features() -> pd.DataFrame:
    return features.build_season_features(TEST_SEASON)


@lru_cache(maxsize=1)
def _games() -> pd.DataFrame:
    return ingest.load_games(TEST_SEASON - 1, TEST_SEASON)


def _team_results_before(team: str, game_date: str) -> pd.DataFrame:
    g = _games()
    g = g[(g["season"] == TEST_SEASON) & (g["game_date"] < game_date)]
    home = g[g["home_team"] == team].assign(margin=lambda d: d["home_points"] - d["away_points"])
    away = g[g["away_team"] == team].assign(margin=lambda d: d["away_points"] - d["home_points"])
    return pd.concat([home, away]).sort_values("game_date")


def _game_date(game_id: str) -> str:
    g = _games()
    return g.loc[g["game_id"] == game_id, "game_date"].iloc[0]


def test_standings_and_form_use_only_earlier_games():
    df = _season_features()
    row = df[(df["home_team"] == "BOS") & (df["home_games_played"] >= 30)].iloc[0]
    prior = _team_results_before("BOS", _game_date(row["game_id"]))

    k = features.PRIOR_GAMES
    last10 = prior["margin"].tail(features.FORM_WINDOW)
    assert row["home_games_played"] == len(prior)
    assert _is_close(row["home_win_pct"], ((prior["margin"] > 0).sum() + 0.5 * k) / (len(prior) + k))
    assert _is_close(row["home_avg_margin"], prior["margin"].sum() / (len(prior) + k))
    assert _is_close(row["home_last10_margin"], last10.sum() / (len(last10) + k))

    own_margin = row["home_points"] - row["away_points"]
    with_own = pd.concat([prior["margin"], pd.Series([own_margin])])
    assert not _is_close(row["home_avg_margin"], with_own.sum() / (len(with_own) + k)), (
        "season margin includes the target game"
    )


def test_opening_night_is_pure_league_average_prior():
    df = _season_features()
    first_date = _games()[_games()["season"] == TEST_SEASON]["game_date"].min()
    opener_ids = set(_games().query("game_date == @first_date")["game_id"])
    openers = df[df["game_id"].isin(opener_ids)]
    assert not openers.empty
    assert (openers["home_games_played"] == 0).all()
    assert (openers["home_win_pct"] == 0.5).all()
    assert (openers["away_last10_margin"] == 0).all()


def test_pregame_elo_matches_the_phase3_simulation():
    """features.py computes Elo via an as-of join so it also works for
    unplayed games; for played games it must equal elo.simulate()'s own
    pregame rating exactly, which is leak-free by construction."""
    games = ingest.load_games(ingest.config.START_SEASON, TEST_SEASON)
    sim = elo.simulate(games, ingest.ELO_K, ingest.ELO_HOME_ADVANTAGE).set_index("game_id")
    df = _season_features().set_index("game_id")
    sim = sim.loc[df.index]
    assert (df["home_pregame_elo"] - sim["home_pregame_elo"]).abs().max() < 1e-6
    assert (df["away_pregame_elo"] - sim["away_pregame_elo"]).abs().max() < 1e-6


def test_head_to_head_uses_only_earlier_meetings():
    df = _season_features()
    row = df[df["h2h_games"] >= 2].iloc[len(df[df["h2h_games"] >= 2]) // 2]
    home, away, date = row["home_team"], row["away_team"], _game_date(row["game_id"])

    g = _games()
    pair = g[
        (((g["home_team"] == home) & (g["away_team"] == away)) | ((g["home_team"] == away) & (g["away_team"] == home)))
        & (g["game_date"] < date)
    ].sort_values("game_date").tail(features.H2H_WINDOW)
    from_home = (pair["home_points"] - pair["away_points"]).where(pair["home_team"] == home, pair["away_points"] - pair["home_points"])

    assert row["h2h_games"] == len(pair)
    assert _is_close(row["h2h_margin"], from_home.mean())


def _player_rows() -> pd.DataFrame:
    p = pd.concat(
        [ingest.ingest_player_games(y).assign(season=y) for y in (TEST_SEASON - 1, TEST_SEASON)], ignore_index=True
    )
    p["eff"] = (
        p["PTS"] + p["REB"] + p["AST"] + p["STL"] + p["BLK"]
        - (p["FGA"] - p["FGM"]) - (p["FTA"] - p["FTM"]) - p["TOV"]
    )
    return p


def test_missing_players_never_include_anyone_who_played():
    df = _season_features()
    players = _player_rows()
    sample = df[df["home_missing_players"] != ""].sample(50, random_state=0)
    for row in sample.itertuples():
        played = set(players.loc[(players["GAME_ID"] == row.game_id) & (players["TEAM_ABBREVIATION"] == row.home_team), "PLAYER_NAME"])
        listed = {n for n in row.home_missing_players.split(", ") if not n.startswith("+")}
        assert not listed & played, f"{row.game_id}: {listed & played} played but were counted missing"


def test_missing_players_are_valued_only_from_earlier_games():
    """Pick games where every missing player is named (no "+N more"), and
    recompute missing_eff as the sum of each one's mean EFF over their last
    PLAYER_VALUE_WINDOW appearances strictly before the game's date."""
    df = _season_features()
    players = _player_rows()
    fully_named = df[(df["home_missing_players"] != "") & ~df["home_missing_players"].str.contains(r"\+")]
    checked = 0
    for row in fully_named.sample(25, random_state=1).itertuples():
        date = _game_date(row.game_id)
        expected = 0.0
        for name in row.home_missing_players.split(", "):
            history = players[(players["PLAYER_NAME"] == name) & (players["GAME_DATE"] < date)].sort_values("GAME_DATE")
            expected += max(history["eff"].tail(features.PLAYER_VALUE_WINDOW).mean(), 0)
        assert _is_close(row.home_missing_eff, expected, tol=1e-6), (
            f"{row.game_id}: missing_eff {row.home_missing_eff} != leak-free recomputation {expected}"
        )
        checked += 1
    assert checked == 25


def test_rest_days_count_from_the_previous_game():
    df = _season_features()
    row = df[df["home_games_played"] >= 10].iloc[0]
    prior = _team_results_before(row["home_team"], _game_date(row["game_id"]))
    gap = (pd.Timestamp(_game_date(row["game_id"])) - pd.Timestamp(prior["game_date"].iloc[-1])).days - 1
    assert row["home_rest_days"] == min(max(gap, 0), features.REST_CAP)
