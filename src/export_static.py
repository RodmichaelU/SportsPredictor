"""Export everything the website shows as static JSON, for the static build
(GitHub Pages): the frontend reads these files at build time instead of
calling the API, and the browser fetches the few it needs interactively
(model curves). Run after refresh.py, so the files reflect the latest
predictions, results, and market prices.

Calls the API's handler functions in-process -- same code paths and
response shapes as the live API, no server needed. Market prices are
fetched once here, so the site's odds are "as of this export"; meta.json's
refreshed_at is what the site shows as its last-updated time.

Layout (under --out, default frontend/public/data):
    meta.json, sports.json, parlays/all.json
    <sport>/predictions.json, results.json, accuracy.json, accuracy-by-week.json,
            calibration.json, model-weights.json, standings.json, logos.json,
            teams.json ([{team, slug}]), team/<slug>.json, explain/<game_id>.json,
            curves/<feature>__<win|margin>.json, parlays.json

Run: python -m src.export_static
"""

import argparse
import json
import re
import shutil
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import config

DEFAULT_OUT = config.BASE_DIR / "frontend" / "public" / "data"


def slugify(team: str) -> str:
    """URL-safe team slug: "Miami (OH)" -> "miami-oh", "San José State" ->
    "san-jose-state". Static hosting needs plain path segments."""
    ascii_name = unicodedata.normalize("NFKD", team).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-") or "team"


def _write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), default=str))


def _safe(fn, *args, **kwargs):
    """Run an API handler, returning None (and logging) instead of raising --
    one missing piece shouldn't stop the whole export."""
    try:
        return fn(*args, **kwargs)
    except Exception as e:  # HTTPException for 404s, or a data error
        print(f"  skipped {fn.__name__}{args}: {type(e).__name__}: {getattr(e, 'detail', e)}", file=sys.stderr)
        return None


def export(out: Path) -> dict:
    # Imported here so `--help` doesn't pay for loading every model module.
    from api import main as api

    started = time.monotonic()
    tmp = out.with_name(out.name + ".tmp")
    shutil.rmtree(tmp, ignore_errors=True)

    sports = api.get_sports()
    live = [s["id"] for s in sports if s["status"] == "live"]
    _write(tmp / "sports.json", sports)

    counts = {}
    for sport in live:
        d = tmp / sport
        predictions = api.get_predictions(sport, week=None)
        results = api.get_results(sport, week=None)
        _write(d / "predictions.json", predictions)
        _write(d / "results.json", results)
        _write(d / "accuracy.json", api.get_accuracy(sport))
        _write(d / "accuracy-by-week.json", api.get_accuracy_by_week(sport))
        _write(d / "calibration.json", api.get_calibration(sport, n_bins=10))
        _write(d / "logos.json", api.get_team_logos(sport))
        standings = _safe(api.get_standings, sport, season=None) or {"sport": sport, "season": config.CURRENT_SEASON, "groups": []}
        _write(d / "standings.json", standings)

        weights = api.get_model_weights(sport)
        _write(d / "model-weights.json", weights)
        for w in weights["weights"]:
            for target in ("win", "margin"):
                curve = _safe(api.get_model_curve, sport, feature=w["feature"], target=target)
                if curve:
                    _write(d / "curves" / f"{w['feature']}__{target}.json", curve)

        # Every team with a page: anyone with a prediction, plus anyone in
        # the standings (linked from /standings even before their first pick).
        names = set(api.get_teams(sport))
        names |= {t["team"] for g in standings["groups"] for t in g["teams"]}
        slugs, used = {}, set()
        for name in sorted(names):
            slug, n = slugify(name), 2
            while slug in used:  # vanishingly rare, but keep slugs unique
                slug, n = f"{slugify(name)}-{n}", n + 1
            used.add(slug)
            slugs[name] = slug
        teams_written = []
        for name, slug in slugs.items():
            detail = _safe(api.get_team, sport, team=name)
            if detail:
                _write(d / "team" / f"{slug}.json", detail)
                teams_written.append({"team": name, "slug": slug})
        _write(d / "teams.json", teams_written)

        game_ids = {str(p["game_id"]) for p in predictions} | {str(r["game_id"]) for r in results}
        explained = 0
        for game_id in sorted(game_ids):
            explanation = _safe(api.get_explain, sport, game_id=game_id)
            if explanation:
                _write(d / "explain" / f"{game_id}.json", explanation)
                explained += 1

        _write(d / "parlays.json", api.get_parlays(sports=sport, horizon_days=7))
        counts[sport] = {"games": explained, "teams": len(teams_written)}
        print(f"  {sport}: {explained} games, {len(teams_written)} teams")

    _write(tmp / "parlays" / "all.json", api.get_parlays(sports=None, horizon_days=7))

    meta = {
        # What the site shows as "last updated": the moment these files (and
        # their market prices) were produced.
        "refreshed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "refresh_interval_hours": 3,
        "counts": counts,
    }
    _write(tmp / "meta.json", meta)

    # Swap in atomically-ish, so a half-written export never gets built.
    shutil.rmtree(out, ignore_errors=True)
    tmp.rename(out)
    print(f"Exported to {out} in {time.monotonic() - started:.0f}s")
    return meta


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    export(args.out)


if __name__ == "__main__":
    main()
