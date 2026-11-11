"""The static site grades parlays in the browser with frontend/lib/parlayRating.js,
a port of src/parlay.py's rate_parlay. Runs the JS under Node on the same
slips as the Python and fails on any difference in grade, score, odds,
verdicts, or summary -- so the two can't drift apart.

Skipped when Node isn't installed (the GitHub workflow has it)."""

import json
import math
import shutil
import subprocess
from datetime import timedelta

import pytest

from src import parlay
from tests.test_parlay import NOW, _game

ROOT = __import__("config").BASE_DIR
JS = ROOT / "frontend" / "lib" / "parlayRating.js"

# Slips covering every verdict, both signs of expected return, the suspect
# fallback, and odds on both sides of even money.
SLIPS = [
    [(0.70, 0.60, "home"), (0.66, 0.55, "home"), (0.60, 0.50, "home")],
    [(0.64, 0.78, "home"), (0.57, 0.68, "home")],
    [(0.60, 0.20, "home"), (0.70, 0.69, "home")],
    [(0.70, 0.60, "home"), (0.50, 0.50, "home"), (0.45, 0.55, "away")],
    [(0.88, 0.86, "home"), (0.91, 0.88, "home")],
    [(0.36, 0.22, "home"), (0.49, 0.40, "home"), (0.43, 0.32, "home"), (0.54, 0.44, "home"), (0.80, 0.85, "away")],
]


def _slip_legs(spec, offset):
    preds = [_game(offset + i, m, q) for i, (m, q, _) in enumerate(spec)]
    legs = {(leg["game_id"], leg["is_home"]): leg for leg in parlay.candidate_legs(preds, NOW, timedelta(days=7))}
    return [legs[(f"g{offset + i}", side == "home")] for i, (_, _, side) in enumerate(spec)]


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_js_rating_matches_python():
    slips = [_slip_legs(spec, 500 + 10 * n) for n, spec in enumerate(SLIPS)]
    script = (
        f"import {{ rateParlay }} from {json.dumps(JS.as_uri())};"
        "const { readFileSync } = await import('node:fs');"
        "const slips = JSON.parse(readFileSync(0, 'utf8'));"
        "process.stdout.write(JSON.stringify(slips.map(rateParlay)));"
    )
    out = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        input=json.dumps(slips), capture_output=True, text=True, check=True,
    )
    js_ratings = json.loads(out.stdout)

    for legs, js in zip(slips, js_ratings):
        py = parlay.rate_parlay(legs)
        for key in ("grade", "score", "american_odds", "summary", "counts", "weakest_leg"):
            assert js[key] == py[key], (key, js[key], py[key])
        for key in ("hit_probability", "market_hit_probability", "decimal_odds", "expected_return"):
            assert math.isclose(js[key], py[key], rel_tol=1e-12), key
        assert [l["verdict"] for l in js["legs"]] == [l["verdict"] for l in py["legs"]]


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_js_american_odds_matches_python():
    values = [1.01, 1.25, 1.5, 1.909, 2.0, 2.005, 2.5, 3.5, 54.1, 1610.46]
    script = (
        f"import {{ americanOdds }} from {json.dumps(JS.as_uri())};"
        f"process.stdout.write(JSON.stringify({json.dumps(values)}.map(americanOdds)));"
    )
    out = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, check=True)
    assert json.loads(out.stdout) == [parlay.american_odds(v) for v in values]
