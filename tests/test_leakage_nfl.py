"""Fails if any pre-game feature uses data from the target game or a later
one. Same discipline as test_leakage_cfb.py, adapted to NFL's data shape
(EPA from nflreadpy's weekly team stats instead of CFBD's advanced stats;
week order is a safe chronological sort since NFL teams play at most once
per week, unlike CFB's occasional Week 0/1 doubleheaders)."""

import math

from src.sports.nfl import features, ingest

TEST_SEASON = 2023


def _is_close(a, b, tol=1e-9):
    return math.isclose(a, b, rel_tol=tol, abs_tol=tol)


def test_season_to_date_epa_excludes_current_and_future_games():
    df = features.build_season_features(TEST_SEASON)
    row = df[(df["home_team"] == "KC") & (df["week"] == 6)].iloc[0]

    stats = ingest.ingest_team_stats(TEST_SEASON, TEST_SEASON)
    prior_games = stats[(stats["team"] == "KC") & (stats["week"] < 6)]
    expected_off_epa = (prior_games["passing_epa"] + prior_games["rushing_epa"]).mean()

    assert _is_close(row["home_off_epa"], expected_off_epa), (
        f"home_off_epa {row['home_off_epa']} does not match leak-free recomputation {expected_off_epa}"
    )

    own_game = stats[(stats["team"] == "KC") & (stats["week"] == 6)].iloc[0]
    own_epa = own_game["passing_epa"] + own_game["rushing_epa"]
    assert not _is_close(row["home_off_epa"], own_epa), "feature matches the target game's own EPA"


def test_each_teams_season_opener_has_no_season_to_date_stats():
    df = features.build_season_features(TEST_SEASON)
    week_one = df[df["week"] == 1]
    assert week_one["home_off_epa"].isna().all(), "home_off_epa is populated in week 1 with no prior games"
    assert week_one["away_off_epa"].isna().all(), "away_off_epa is populated in week 1 with no prior games"


def test_rest_days_and_spread_come_straight_from_the_schedule():
    """Unlike the rolling EPA stats, rest days and the closing spread aren't
    computed from history at all -- they're precomputed on the schedule
    itself (known before kickoff by construction), so there's nothing to
    leak. Sanity-check they're populated and the spread sign convention
    matches CFB's (negative closing_spread = home favored)."""
    df = features.build_season_features(TEST_SEASON)
    assert df["home_rest_days"].notna().all()
    assert df["closing_spread"].notna().mean() > 0.9

    heavy_favorite = df.loc[df["closing_spread"].idxmin()]
    assert heavy_favorite["closing_spread"] < -5
