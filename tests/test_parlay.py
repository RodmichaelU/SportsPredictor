"""Parlay Picker invariants (src/parlay.py), on synthetic predictions so the
check is deterministic and needs no network or database.

1. Every leg is a different game, priced, not yet started, inside the horizon.
2. Every leg clears its tier's model-probability and positive-edge bars --
   no parlay leans on a leg the model thinks the market has right -- and no
   leg's edge is so large it's more likely a data problem (MAX_EDGE).
3. Tiers are ordered: higher risk pays more, lower risk hits more often.
4. Reported odds/probabilities are the products of the legs'.
5. A tier with too few qualifying games says so instead of padding.
"""

import math
from datetime import datetime, timedelta, timezone

from src import parlay

NOW = datetime(2026, 11, 10, 18, 0, tzinfo=timezone.utc)


def _game(i, model_home, market_home, hours_ahead=24, sport="nfl"):
    return {
        "game_id": f"g{i}",
        "sport": sport,
        "home_team": f"H{i}",
        "away_team": f"A{i}",
        "game_date": (NOW + timedelta(hours=hours_ahead)).isoformat().replace("+00:00", "Z"),
        "win_probability": model_home,
        "market_home_probability": market_home,
        "market_source": "snapshot",
        "market_captured_at": NOW.isoformat(),
    }


# A slate with a spread of favorites, value spots, and model-backed underdogs.
SLATE = [
    _game(1, 0.86, 0.80),
    _game(2, 0.82, 0.78),
    _game(3, 0.78, 0.70),
    _game(4, 0.70, 0.60),
    _game(5, 0.64, 0.52),
    _game(6, 0.60, 0.48),
    _game(7, 0.47, 0.33),  # model has the home underdog far likelier than the market
    _game(8, 0.44, 0.30),
    _game(9, 0.58, 0.45, sport="cfb"),
    _game(10, 0.55, 0.62),  # model below market: never a leg on this side
    _game(14, 0.60, 0.20),  # 40-point gap: a data problem, never a leg
    _game(11, 0.90, 0.70, hours_ahead=-2),  # already started
    _game(12, 0.90, 0.70, hours_ahead=24 * 10),  # outside the 7-day horizon
    {**_game(13, 0.90, 0.70), "market_home_probability": None},  # no market price
]


def _tiers():
    out = parlay.build_parlays(SLATE, now=NOW)
    return {t["tier"]: t for t in out["tiers"]}


def test_legs_are_distinct_priced_upcoming_games():
    for t in _tiers().values():
        keys = [(leg["sport"], leg["game_id"]) for leg in t["legs"]]
        assert len(keys) == len(set(keys))
        for leg in t["legs"]:
            assert leg["game_id"] not in {"g11", "g12", "g13"}
            start = datetime.fromisoformat(leg["game_date"].replace("Z", "+00:00"))
            assert NOW < start <= NOW + timedelta(days=7)


def test_every_leg_clears_its_tier_bars():
    by_key = {t.key: t for t in parlay.TIERS}
    for key, t in _tiers().items():
        tier = by_key[key]
        assert t["available"], f"{key} should be buildable from this slate"
        assert t["value"], f"{key} should be a value parlay, not the fallback"
        assert tier.min_legs <= len(t["legs"]) <= tier.max_legs
        for leg in t["legs"]:
            assert leg["model_probability"] >= tier.min_model_prob
            assert leg["edge"] >= tier.min_edge
            assert leg["model_probability"] > leg["market_probability"]
            assert leg["edge"] <= parlay.MAX_EDGE
            assert leg["market_probability"] <= tier.max_market_prob
            assert leg["game_id"] != "g14"
        assert t["hit_probability"] >= tier.min_hit_prob


def test_tiers_trade_hit_chance_for_payout():
    t = _tiers()
    assert t["low"]["decimal_odds"] < t["medium"]["decimal_odds"] < t["high"]["decimal_odds"]
    assert t["low"]["hit_probability"] > t["medium"]["hit_probability"] > t["high"]["hit_probability"]


def test_high_risk_reaches_for_model_backed_underdogs():
    legs = _tiers()["high"]["legs"]
    assert any(leg["model_probability"] < 0.5 for leg in legs)


def test_parlay_totals_are_products_of_legs():
    for t in _tiers().values():
        legs = t["legs"]
        assert math.isclose(t["decimal_odds"], math.prod(1 / leg["market_probability"] for leg in legs))
        assert math.isclose(t["hit_probability"], math.prod(leg["model_probability"] for leg in legs))
        assert math.isclose(t["expected_return"], t["hit_probability"] * t["decimal_odds"] - 1)


def test_thin_slate_reports_unavailable_instead_of_padding():
    out = parlay.build_parlays([_game(1, 0.86, 0.80)], now=NOW)
    for t in out["tiers"]:
        assert not t["available"]
        assert t["legs"] == []
        assert "reason" in t


def test_american_odds_conversion():
    assert parlay.american_odds(2.0) == 100
    assert parlay.american_odds(3.5) == 250
    assert parlay.american_odds(1.5) == -200


def test_no_value_slate_falls_back_to_labeled_model_favorites():
    # Every favorite is priced above the model (like an NBA day where the
    # market likes the chalk more than we do): no value legs anywhere.
    slate = [_game(1, 0.85, 0.90), _game(2, 0.64, 0.74), _game(3, 0.57, 0.66), _game(4, 0.52, 0.55)]
    out = parlay.build_parlays(slate, now=NOW)
    for t in out["tiers"]:
        if not t["available"]:
            continue
        assert t["value"] is False
        assert "note" in t
        assert len(t["legs"]) >= parlay.FALLBACK_MIN_LEGS
        tier = next(x for x in parlay.TIERS if x.key == t["tier"])
        for leg in t["legs"]:
            assert leg["model_probability"] > 0.5  # only the model's own picks
            assert leg["market_probability"] <= tier.max_market_prob
            assert abs(leg["edge"]) <= parlay.MAX_EDGE
    assert out["tiers"][0]["available"], "low risk should fall back rather than stay empty"
