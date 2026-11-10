"""Parlay Picker: combine upcoming predictions into multi-leg parlays at three
risk tiers. Sport-agnostic -- operates on the API's prediction dicts (game_id,
sport, home_team, away_team, game_date, win_probability,
market_home_probability), so legs can mix leagues.

Pricing comes from the market, not the model. A Kalshi contract on one side
costs that side's implied probability q and pays $1, so its decimal odds are
1/q (fair odds, no vig). The model supplies p, the chance the leg actually
hits. A parlay pays the product of its legs' odds and hits with the product of
their probabilities -- which assumes the games are independent, so a parlay
never takes two legs from the same game.

Each tier trades hit chance against payout with one knob, payout_weight (λ).
A leg scores log(p) + λ·log(1/q), so a parlay's total score is
log(P(hit)) + λ·log(payout):
  - λ near 0 is "maximize the chance of cashing" (low risk);
  - λ = 1 makes the score log(p/q) per leg, i.e. maximize expected return,
    which is what reaches for long, underpriced odds (high risk).
Legs beyond a tier's minimum count are only added while they raise that
score, and never past the tier's hit-chance floor.

Every tier also requires each leg to have a positive edge (model p above
market q). "Ambitious" here means the market undervalues the pick, not just
that the odds are long: a parlay never leans on a leg the model thinks the
market has priced correctly or too generously. Edges above MAX_EDGE are
excluded as likely data problems rather than opportunities.

Run: python -m src.parlay            (prints this week's tiers)
"""

import argparse
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# Same guards as the frontend's value-bet ranking (lib/valueBets.ts): prices
# at the extremes are where both models and markets are least reliable, and
# a near-certain leg adds almost nothing to a parlay's payout.
MIN_MARKET_PROB = 0.05
MAX_MARKET_PROB = 0.97

# A model-vs-market gap this large is treated as a data problem, not an edge.
# Real disagreements with a liquid market are a few points (NFL's largest
# this week is 5); 15+ points almost always means the model was missing an
# input -- e.g. a CFB pick frozen before that game's betting line was posted,
# so the spread was imputed as a near pick'em. Leaning on those would turn
# the parlay into a bet on our own blind spots.
MAX_EDGE = 0.15


@dataclass(frozen=True)
class Tier:
    key: str
    label: str
    min_model_prob: float  # each leg's model win probability must be at least this
    min_edge: float  # ... and beat the market's price by at least this many points
    payout_weight: float  # λ: how much payout counts against hit chance
    min_legs: int
    max_legs: int
    min_hit_prob: float  # the whole parlay's model hit chance must stay above this
    # Legs priced above this are left out: a -500 favorite barely moves a
    # parlay's payout, so a tier meant to pay has to skip them.
    max_market_prob: float = MAX_MARKET_PROB


# Edge minimums are sized for the tightest market we price: NFL, where the
# model leans on the spread and most disagreements are 1-2 points. CFB's
# gaps run larger, so its legs clear these easily and the payout weight --
# not the edge bar -- is what separates the tiers there.
TIERS = [
    Tier("low", "Low risk", min_model_prob=0.65, min_edge=0.01, payout_weight=0.2,
         min_legs=2, max_legs=3, min_hit_prob=0.40),
    Tier("medium", "Medium risk", min_model_prob=0.55, min_edge=0.01, payout_weight=0.6,
         min_legs=3, max_legs=4, min_hit_prob=0.18, max_market_prob=0.75),
    # Allows underdogs the model still gives a real chance (35%+) when the
    # market rates them as bigger ones -- that gap is where the long payouts are.
    Tier("high", "High risk", min_model_prob=0.35, min_edge=0.03, payout_weight=1.0,
         min_legs=4, max_legs=6, min_hit_prob=0.04),
]


def american_odds(decimal_odds: float) -> int:
    """Decimal odds -> American (+250 / -150) for display."""
    if decimal_odds >= 2:
        return round((decimal_odds - 1) * 100)
    return -round(100 / (decimal_odds - 1))


def candidate_legs(predictions: list[dict], now: datetime, horizon: timedelta) -> list[dict]:
    """Both sides of every priced, not-yet-started game inside the horizon."""
    legs = []
    for p in predictions:
        q_home = p.get("market_home_probability")
        if q_home is None:
            continue
        start = datetime.fromisoformat(p["game_date"].replace("Z", "+00:00"))
        if not (now < start <= now + horizon):
            continue
        for is_home in (True, False):
            q = q_home if is_home else 1 - q_home
            if not (MIN_MARKET_PROB <= q <= MAX_MARKET_PROB):
                continue
            model_p = p["win_probability"] if is_home else 1 - p["win_probability"]
            legs.append(
                {
                    "game_id": str(p["game_id"]),
                    "sport": p["sport"],
                    "team": p["home_team"] if is_home else p["away_team"],
                    "opponent": p["away_team"] if is_home else p["home_team"],
                    "is_home": is_home,
                    "game_date": p["game_date"],
                    "model_probability": model_p,
                    "market_probability": q,
                    "edge": model_p - q,
                    "decimal_odds": 1 / q,
                    "american_odds": american_odds(1 / q),
                    "market_source": p.get("market_source"),
                    "market_captured_at": p.get("market_captured_at"),
                }
            )
    return legs


def _leg_score(leg: dict, tier: Tier) -> float:
    return math.log(leg["model_probability"]) + tier.payout_weight * math.log(leg["decimal_odds"])


# A fallback parlay (see build_parlay) needs at least this many legs, even in
# tiers whose normal minimum is higher -- thin slates (an NBA day is only the
# games tipping off within 12 hours) rarely have more model favorites to use.
FALLBACK_MIN_LEGS = 2


def _rank(legs: list[dict], tier: Tier) -> list[dict]:
    """Best-scoring side per game, best first."""
    best_by_game: dict[str, dict] = {}
    for leg in legs:
        key = f'{leg["sport"]}:{leg["game_id"]}'
        if key not in best_by_game or _leg_score(leg, tier) > _leg_score(best_by_game[key], tier):
            best_by_game[key] = leg
    return sorted(best_by_game.values(), key=lambda leg: _leg_score(leg, tier), reverse=True)


def _select(ranked: list[dict], tier: Tier, min_legs: int) -> list[dict]:
    chosen: list[dict] = []
    hit = 1.0
    for leg in ranked:
        if len(chosen) >= tier.max_legs:
            break
        # Past the minimum, a leg has to improve the tier's objective.
        if len(chosen) >= min_legs and _leg_score(leg, tier) <= 0:
            break
        if hit * leg["model_probability"] < tier.min_hit_prob:
            continue  # would sink the parlay below the floor; a likelier leg may still fit
        chosen.append(leg)
        hit *= leg["model_probability"]
    return chosen


def build_parlay(legs: list[dict], tier: Tier) -> dict:
    """The tier's value parlay: every leg clears the tier's bars, including a
    positive edge over the market. When the slate can't fill one, falls back
    to the model's own favorites (model above 50%, within the tier's price
    cap, gap under MAX_EDGE) regardless of edge, marked value=False -- the
    model expects those to return less than they cost, and the page says so
    rather than passing them off as value picks."""
    value_legs = [
        leg for leg in legs
        if leg["model_probability"] >= tier.min_model_prob
        and tier.min_edge <= leg["edge"] <= MAX_EDGE
        and leg["market_probability"] <= tier.max_market_prob
    ]
    chosen = _select(_rank(value_legs, tier), tier, tier.min_legs)
    value = len(chosen) >= tier.min_legs

    if not value:
        favorites = [
            leg for leg in legs
            if leg["model_probability"] > 0.5
            and abs(leg["edge"]) <= MAX_EDGE
            and leg["market_probability"] <= tier.max_market_prob
        ]
        chosen = _select(_rank(favorites, tier), tier, FALLBACK_MIN_LEGS)

    base = {"tier": tier.key, "label": tier.label, "legs": [], "available": False, "value": value}
    if len(chosen) < (tier.min_legs if value else FALLBACK_MIN_LEGS):
        return {
            **base,
            "reason": (
                "Not enough upcoming games with a market price to build this tier right now. "
                "Check back after the next refresh."
            ),
        }

    chosen.sort(key=lambda leg: leg["game_date"])
    hit = math.prod(leg["model_probability"] for leg in chosen)
    payout = math.prod(leg["decimal_odds"] for leg in chosen)
    market_hit = math.prod(leg["market_probability"] for leg in chosen)
    out = {
        **base,
        "available": True,
        "legs": chosen,
        "hit_probability": hit,
        "market_hit_probability": market_hit,
        "decimal_odds": payout,
        "american_odds": american_odds(payout),
        # Per $1 staked, if the model's probabilities are right.
        "expected_return": hit * payout - 1,
    }
    if not value:
        overpriced = sum(leg["edge"] <= 0 for leg in chosen)
        out["note"] = (
            "No value parlay for this tier right now, so these are the model's likeliest picks instead. "
            f"The market prices {overpriced} of {len(chosen)} legs higher than the model rates them."
        )
    return out


def build_parlays(predictions: list[dict], now: datetime | None = None, horizon_days: int = 7) -> dict:
    now = now or datetime.now(timezone.utc)
    legs = candidate_legs(predictions, now, timedelta(days=horizon_days))
    return {
        "generated_at": now.isoformat(),
        "priced_games": len({(leg["sport"], leg["game_id"]) for leg in legs}),
        "tiers": [build_parlay(legs, tier) for tier in TIERS],
        # Every pickable side, for the build-your-own rater (rate_parlay).
        "candidates": sorted(legs, key=lambda leg: (leg["game_date"], leg["sport"], leg["game_id"], leg["is_home"])),
    }


# ---------------------------------------------------------------------------
# Build-your-own rating
#
# Grades any set of legs a user picks. The headline is the parlay's expected
# return by the model's numbers -- the one figure that captures both "how
# likely" and "how much it pays" -- turned into a 0-100 score and an A-F
# grade, with per-leg flags explaining what's helping or hurting it.

MIN_RATED_LEGS = 2
MAX_RATED_LEGS = 12

# Per-leg verdicts, by model-minus-market edge.
FAIR_BAND = 0.01  # within a point either way: the model and market agree

# How quickly the score saturates toward A or F: an expected return of
# about +35% (or -26%, its log mirror) lands three quarters of the way there.
SCORE_SCALE = 0.35
OVERPRICED_PENALTY = 6  # points off per leg the market overrates
SUSPECT_PENALTY = 4  # points off per leg whose model number looks unreliable

GRADES = [(80, "A"), (65, "B"), (50, "C"), (35, "D"), (0, "F")]


def leg_verdict(leg: dict) -> str:
    if abs(leg["edge"]) > MAX_EDGE:
        return "suspect"  # gap too big to trust; see MAX_EDGE
    if leg["edge"] >= FAIR_BAND:
        return "value"
    if leg["edge"] <= -FAIR_BAND:
        return "overpriced"
    return "fair"


def rate_parlay(legs: list[dict]) -> dict:
    """Score a user-built parlay. `legs` are candidate_legs() entries (one
    side per game). Suspect legs count at the market's price rather than the
    model's, so a likely data problem can't inflate the grade."""
    keys = [(leg["sport"], leg["game_id"]) for leg in legs]
    if len(keys) != len(set(keys)):
        raise ValueError("A parlay can't include both sides, or the same game twice.")
    if not MIN_RATED_LEGS <= len(legs) <= MAX_RATED_LEGS:
        raise ValueError(f"Pick between {MIN_RATED_LEGS} and {MAX_RATED_LEGS} legs.")

    rated = []
    for leg in legs:
        verdict = leg_verdict(leg)
        trusted_p = leg["market_probability"] if verdict == "suspect" else leg["model_probability"]
        rated.append({**leg, "verdict": verdict, "trusted_probability": trusted_p})

    hit = math.prod(leg["trusted_probability"] for leg in rated)
    payout = math.prod(leg["decimal_odds"] for leg in rated)
    market_hit = math.prod(leg["market_probability"] for leg in rated)
    expected_return = hit * payout - 1
    counts = {v: sum(leg["verdict"] == v for leg in rated) for v in ("value", "fair", "overpriced", "suspect")}

    score = 50 + 45 * math.tanh(math.log(1 + expected_return) / SCORE_SCALE)
    score -= OVERPRICED_PENALTY * counts["overpriced"] + SUSPECT_PENALTY * counts["suspect"]
    score = max(0, min(100, round(score)))
    grade = next(g for floor, g in GRADES if score >= floor)

    # The leg dragging the parlay down most: the worst trusted edge.
    weakest = min(rated, key=lambda leg: leg["trusted_probability"] - leg["market_probability"])

    if expected_return >= 0.15 and not counts["overpriced"]:
        summary = "Strong parlay: every leg is priced at or below what the model thinks it's worth."
    elif expected_return >= 0:
        summary = "Decent parlay: the model expects it to pay back a little more than it costs."
    elif counts["overpriced"]:
        summary = (
            f"The market prices {counts['overpriced']} of your {len(rated)} legs higher than the model does, "
            "so the model expects this to lose money."
        )
    else:
        summary = "The model expects this to pay back less than it costs."

    return {
        "score": score,
        "grade": grade,
        "summary": summary,
        "legs": rated,
        "hit_probability": hit,
        "market_hit_probability": market_hit,
        "decimal_odds": payout,
        "american_odds": american_odds(payout),
        "expected_return": expected_return,
        "counts": counts,
        "weakest_leg": None if weakest["trusted_probability"] >= weakest["market_probability"] else {
            "team": weakest["team"],
            "verdict": weakest["verdict"],
            "model_probability": weakest["model_probability"],
            "market_probability": weakest["market_probability"],
        },
    }


def main():
    import requests

    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000", help="base URL of the running API")
    args = parser.parse_args()
    out = requests.get(f"{args.api}/parlays", timeout=60).json()
    print(f"{out['priced_games']} priced games")
    for t in out["tiers"]:
        if not t["available"]:
            print(f"\n{t['label']}: unavailable -- {t['reason']}")
            continue
        print(
            f"\n{t['label']}: {len(t['legs'])} legs, hits {t['hit_probability']:.1%} (market {t['market_hit_probability']:.1%}), "
            f"pays {t['decimal_odds']:.2f}x ({t['american_odds']:+d}), EV {t['expected_return']:+.0%}"
        )
        for leg in t["legs"]:
            print(
                f"  {leg['sport'].upper():4} {leg['team']} {'vs' if leg['is_home'] else '@'} {leg['opponent']}: "
                f"model {leg['model_probability']:.0%} / market {leg['market_probability']:.0%} ({leg['american_odds']:+d})"
            )


if __name__ == "__main__":
    main()
