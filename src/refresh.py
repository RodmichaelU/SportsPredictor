"""One-shot automatic refresh: re-pull the current season's data, freeze any
new predictions, and reconcile finished games -- the same three steps that
were previously run by hand (delete stale cache files, `predict.py` per
week, `reconcile.py`) whenever someone wanted an up-to-date accuracy read.

Only the *current, in-progress* season's cache is busted -- completed
seasons are immutable and never re-fetched, which is what keeps this safe to
run on a schedule against the CFBD free tier's 1,000 calls/month.

Meant to be run automatically (see scripts/refresh.sh + the launchd agent in
scripts/com.sportspredictor.refresh.plist), but also safe to run by hand:

Run: python -m src.refresh --all
     python -m src.refresh --sport cfb --season 2026
"""

import argparse

import config
from src import predict, reconcile

# Sports with a real model layer (features.py isn't a stub). NBA/NHL stay
# out of this until their model layer exists -- see api/main.py's SPORTS
# list, which is the other place this same "live" set is defined.
LIVE_SPORTS = ["cfb", "nfl"]

# Generous upper bound used only to stop searching for the nearest upcoming
# week -- covers regular season + postseason/bowls for both sports.
MAX_WEEK = {"cfb": 20, "nfl": 22}


def _bust_cfb_cache(season: int) -> int:
    from src.sports.cfb import client
    from src.sports.cfb.ingest import SEASON_TYPE

    endpoints = [
        ("/games", {"year": season, "seasonType": SEASON_TYPE, "classification": config.DIVISION}),
        ("/lines", {"year": season, "seasonType": SEASON_TYPE, "classification": config.DIVISION}),
        ("/stats/game/advanced", {"year": season, "seasonType": SEASON_TYPE}),
        ("/talent", {"year": season}),
        ("/ratings/sp", {"year": season}),
    ]
    removed = 0
    for endpoint, params in endpoints:
        path = client.cache_file(endpoint, params)
        if path.exists():
            path.unlink()
            removed += 1
    return removed


def _bust_nfl_cache() -> None:
    import nflreadpy

    nflreadpy.clear_cache()


def refresh_sport(sport: str, season: int) -> dict:
    if sport == "cfb":
        _bust_cfb_cache(season)
    elif sport == "nfl":
        _bust_nfl_cache()

    # Only the nearest upcoming week: build_upcoming_features carries each
    # team's *current* rolling stats forward onto its next game, which is a
    # fine stand-in for "the week about to happen" but goes stale the
    # further out it's applied. Freezing weeks months away off of today's
    # early-season form would lock in a worse prediction than the one we'd
    # make once that week is actually close -- so this waits and lets a
    # later run predict each week as it becomes the nearest one, instead of
    # front-running the whole rest of the season in one shot.
    inserted = 0
    week_predicted = None
    for week in range(1, MAX_WEEK[sport] + 1):
        rows = predict.generate_predictions(sport, season, week)
        if rows:
            inserted = predict.save_predictions(rows)
            week_predicted = week
            break

    reconciled = reconcile.reconcile(sport)
    return {
        "sport": sport,
        "season": season,
        "week": week_predicted,
        "predictions_saved": inserted,
        "results_reconciled": reconciled,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sport", choices=LIVE_SPORTS)
    parser.add_argument("--season", type=int, default=config.CURRENT_SEASON)
    parser.add_argument("--all", action="store_true", help="Refresh every live sport")
    args = parser.parse_args()

    if not args.all and not args.sport:
        parser.error("pass --sport <cfb|nfl> or --all")

    for sport in LIVE_SPORTS if args.all else [args.sport]:
        summary = refresh_sport(sport, args.season)
        week = summary["week"]
        week_label = f"week {week}" if week is not None else "no upcoming week found"
        print(
            f"{summary['sport']} {summary['season']} ({week_label}): "
            f"{summary['predictions_saved']} new predictions saved, "
            f"{summary['results_reconciled']} results reconciled"
        )


if __name__ == "__main__":
    main()
