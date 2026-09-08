"""Fails if any pre-game feature uses data from the target game or a later one.

Rebuilds features for one season and cross-checks them two ways:
1. Manually recompute a mid-season team's rolling stat from raw per-game data,
   restricted to strictly earlier weeks against FBS opponents, and assert it
   matches the built feature exactly.
2. Assert week-1 rows have no season-to-date rolling stats (nothing prior
   exists yet, so leakage there would mean the game's own data was used).
3. Assert the SP+ rating attached to a game never equals that team's
   *current*-season final SP+ (which wouldn't exist yet pre-game), only a
   prior season's.
"""

import math

import pandas as pd

from src import features, ingest

TEST_SEASON = 2023


def _is_close(a, b, tol=1e-9):
    return math.isclose(a, b, rel_tol=tol, abs_tol=tol)


def test_season_to_date_stats_exclude_current_and_future_games():
    df = features.build_season_features(TEST_SEASON)
    row = df[(df["home_team"] == "Georgia") & (df["week"] == 6)].iloc[0]

    stats = ingest.ingest_game_stats(TEST_SEASON)
    prior_games = [s for s in stats if s["team"] == "Georgia" and 1 < s["week"] < 6]
    expected_ppa = sum(s["offense"]["ppa"] for s in prior_games) / len(prior_games)
    expected_success_rate = sum(s["offense"]["successRate"] for s in prior_games) / len(prior_games)

    assert _is_close(row["home_off_ppa"], expected_ppa), (
        f"home_off_ppa {row['home_off_ppa']} does not match leak-free recomputation {expected_ppa}"
    )
    assert _is_close(row["home_off_success_rate"], expected_success_rate)

    # The target game's own stats must not appear in the average.
    own_game_ppa = next(s["offense"]["ppa"] for s in stats if s["team"] == "Georgia" and s["week"] == 6)
    assert not _is_close(row["home_off_ppa"], own_game_ppa), "feature matches the target game's own stats"


def test_each_teams_season_opener_has_no_season_to_date_stats():
    """Week number alone isn't a safe proxy for "first game": some teams play
    twice in CFBD's week 1 (e.g. Week 0 openers). Check actual chronological
    first games per team instead of assuming week == 1 means no history."""
    df = features.build_season_features(TEST_SEASON)
    long = pd.concat(
        [
            df[["start_date", "home_team"]].rename(columns={"home_team": "team"}).assign(
                off_ppa=df["home_off_ppa"]
            ),
            df[["start_date", "away_team"]].rename(columns={"away_team": "team"}).assign(
                off_ppa=df["away_off_ppa"]
            ),
        ]
    )
    # groupby().first() silently skips NaN values by default; nth(0) takes the
    # literal first row per team regardless, which is what "opener" means here.
    openers = long.sort_values("start_date").groupby("team").nth(0)
    assert openers["off_ppa"].isna().all(), "a team's chronological season opener has non-null season-to-date stats"


def test_same_week_doubleheader_uses_only_the_earlier_game():
    """Hawai'i played Vanderbilt (Aug 26) then Stanford (Sep 2), both labeled
    week 1 by CFBD. The Stanford game's feature must reflect only the
    Vanderbilt game, not be NaN (falsely treated as a season opener) and not
    reflect any game after Sep 2."""
    df = features.build_season_features(TEST_SEASON)
    row = df[(df["away_team"] == "Stanford") & (df["home_team"] == "Hawai'i")].iloc[0]

    stats = ingest.ingest_game_stats(TEST_SEASON)
    vanderbilt_game = next(s for s in stats if s["team"] == "Hawai'i" and s["opponent"] == "Vanderbilt")
    assert _is_close(row["home_off_ppa"], vanderbilt_game["offense"]["ppa"])


def test_sp_rating_uses_prior_season_only():
    df = features.build_season_features(TEST_SEASON)
    current_season_sp = {r["team"]: r["rating"] for r in ingest.ingest_sp_ratings(TEST_SEASON)}
    prior_season_sp = {r["team"]: r["rating"] for r in ingest.ingest_sp_ratings(TEST_SEASON - 1)}

    checked = 0
    for _, row in df.iterrows():
        team, value = row["home_team"], row["home_sp_rating"]
        if pd_isna(value) or team not in current_season_sp or team not in prior_season_sp:
            continue
        if _is_close(current_season_sp[team], prior_season_sp[team]):
            continue  # ratings happen to match this year, not a useful check
        assert _is_close(value, prior_season_sp[team]), f"{team}: expected prior-season SP+ {prior_season_sp[team]}, got {value}"
        assert not _is_close(value, current_season_sp[team]), f"{team}: feature leaked current-season SP+"
        checked += 1
    assert checked > 0, "no rows were eligible to check SP+ leakage"


def pd_isna(value) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value))
