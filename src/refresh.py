"""One-shot automatic refresh: re-pull the current season's data, freeze any
new predictions, reconcile finished games, and save live Kalshi prices for
games not yet started (src/market_history.py). The first three are the steps
that were previously run by hand (delete stale cache files, `predict.py` per
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
import sys
import traceback
from datetime import datetime, timedelta, timezone

import config
from src import market_history, predict, reconcile

# Sports with a real model layer (features.py isn't a stub). NHL stays out
# of this until its model layer exists -- see api/main.py's SPORTS list,
# which is the other place this same "live" set is defined. NBA goes last:
# it depends on ESPN's injury feed, and an outage there shouldn't stop the
# football sports from refreshing first.
LIVE_SPORTS = ["cfb", "nfl", "nba"]

# Generous upper bound used only to stop searching for the nearest upcoming
# week -- covers regular season + postseason/bowls for football, and the
# ~25-week NBA regular season.
MAX_WEEK = {"cfb": 20, "nfl": 22, "nba": 27}

# Only freeze games tipping off within this window. NBA predictions use the
# live injury report, which changes daily, so freezing a Sunday game on
# Monday would lock in a stale report. With refresh running every 3 hours,
# a 12-hour window still gives each game several chances to be frozen.
PREDICTION_HORIZON = {"nba": timedelta(hours=12)}

# Games past the freeze horizon but inside this window get an *early*
# prediction: computed every run with today's data, saved to
# early_predictions (replaced each run), and used to widen the Parlay
# Picker's pool and fill the predictions page, flagged as early lines.
# Without it the NBA page is empty overnight, until games come within 12
# hours. Never frozen or graded.
EARLY_HORIZON = {"nba": timedelta(hours=36)}

# A game missing an input its sport needs before freezing (FREEZE_REQUIRES in
# its features module -- the betting line, for football) waits for a later
# run instead of being frozen on an imputed value. Within this long of
# kickoff it's frozen anyway, so a game whose line never posts (rare, small
# conferences) still gets a pick rather than none.
FREEZE_FALLBACK = timedelta(hours=6)


def _early_window(rows: list[dict], now: datetime, horizon: timedelta, early: timedelta) -> list[dict]:
    """Rows starting after the freeze horizon but within the early window."""
    return [
        r for r in rows
        if now + horizon < datetime.fromisoformat(r["game_date"].replace("Z", "+00:00")) <= now + early
    ]


def _ready_to_freeze(rows: list[dict], now: datetime) -> tuple[list[dict], int]:
    """Split predictions into (freeze now, number deferred)."""
    ready = [
        r for r in rows
        if not r.get("missing_inputs")
        or datetime.fromisoformat(r["game_date"].replace("Z", "+00:00")) <= now + FREEZE_FALLBACK
    ]
    return ready, len(rows) - len(ready)


# How stale each in-progress-season CFBD response may get before a refresh
# re-pulls it. Busting all five on every 3-hourly run would cost ~1,200
# calls/month -- over the free tier's 1,000. Games (scores) and lines change
# by the hour and are re-pulled every run; per-game advanced stats and SP+
# only move once games finish, so daily is plenty; recruiting talent is
# effectively fixed in-season. ~550 calls/month total.
CFB_CACHE_MAX_AGE = {
    "/games": timedelta(0),
    "/lines": timedelta(0),
    "/stats/game/advanced": timedelta(hours=20),
    "/ratings/sp": timedelta(hours=20),
    "/talent": timedelta(days=6),
}


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
    now = datetime.now().timestamp()
    removed = 0
    for endpoint, params in endpoints:
        path = client.cache_file(endpoint, params)
        if path.exists() and now - path.stat().st_mtime >= CFB_CACHE_MAX_AGE[endpoint].total_seconds():
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
    elif sport == "nba":
        from src.sports.nba import ingest

        ingest.bust_season_cache(season)

    # Only the nearest upcoming week: build_upcoming_features carries each
    # team's *current* rolling stats forward onto its next game, which is a
    # fine stand-in for "the week about to happen" but goes stale the
    # further out it's applied. Freezing weeks months away off of today's
    # early-season form would lock in a worse prediction than the one we'd
    # make once that week is actually close -- so this waits and lets a
    # later run predict each week as it becomes the nearest one, instead of
    # front-running the whole rest of the season in one shot.
    #
    # A failure here (a data source timing out) must not stop reconcile
    # below: grading finished games doesn't depend on predicting new ones,
    # and skipping it is how results silently stop updating.
    inserted = 0
    deferred = 0
    early_saved = None
    week_predicted = None
    try:
        for week in range(1, MAX_WEEK[sport] + 1):
            rows = predict.generate_predictions(sport, season, week)
            if rows:
                week_rows = rows
                now = datetime.now(timezone.utc)
                horizon = PREDICTION_HORIZON.get(sport)
                if horizon:
                    rows = [r for r in rows if datetime.fromisoformat(r["game_date"]) <= now + horizon]
                # Games already frozen are ignored by save_predictions, so
                # only count deferrals among games that aren't on record yet.
                rows, deferred = _ready_to_freeze(predict.unfrozen(sport, rows), now)
                inserted = predict.save_predictions(rows)
                week_predicted = week
                break
    except Exception:
        print(f"{sport}: predicting new games failed, still reconciling", file=sys.stderr)
        traceback.print_exc()

    # Best-effort, like the Kalshi snapshot: early lines are only previews,
    # so a failure here costs those and nothing else.
    if sport in EARLY_HORIZON and week_predicted is not None:
        try:
            pool = week_rows
            latest = max(datetime.fromisoformat(r["game_date"].replace("Z", "+00:00")) for r in pool)
            if latest < now + EARLY_HORIZON[sport]:
                pool = pool + predict.generate_predictions(sport, season, week_predicted + 1)
            early_rows = _early_window(
                predict.unfrozen(sport, pool), now, PREDICTION_HORIZON.get(sport, timedelta(0)), EARLY_HORIZON[sport]
            )
            early_saved = predict.save_early_predictions(sport, early_rows)
        except Exception as e:
            print(f"{sport}: early predictions failed: {type(e).__name__}: {e}", file=sys.stderr)

    reconciled = reconcile.reconcile(sport)

    # Best-effort: a Kalshi outage costs one snapshot, not the whole refresh
    # -- but say so in the log, rather than reporting a plain "0 saved".
    try:
        snapshots = market_history.snapshot(sport)
    except Exception as e:
        print(f"{sport}: Kalshi snapshot failed: {type(e).__name__}: {e}", file=sys.stderr)
        snapshots = 0

    return {
        "sport": sport,
        "season": season,
        "week": week_predicted,
        "predictions_saved": inserted,
        "predictions_deferred": deferred,
        "early_predictions": early_saved,
        "results_reconciled": reconciled,
        "market_snapshots": snapshots,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sport", choices=LIVE_SPORTS)
    parser.add_argument("--season", type=int, default=config.CURRENT_SEASON)
    parser.add_argument("--all", action="store_true", help="Refresh every live sport")
    args = parser.parse_args()

    if not args.all and not args.sport:
        parser.error("pass --sport <cfb|nfl|nba> or --all")

    # Each sport is isolated: one league's data source being down (CFBD DNS
    # failure, an nflverse 504) shouldn't skip the sports after it. Still
    # exits non-zero if anything failed, so launchd's "last exit code" and
    # the log both show it.
    failed = []
    print(f"--- refresh {datetime.now().astimezone().isoformat(timespec='seconds')}")
    for sport in LIVE_SPORTS if args.all else [args.sport]:
        try:
            summary = refresh_sport(sport, args.season)
        except Exception:
            print(f"{sport}: refresh failed", file=sys.stderr)
            traceback.print_exc()
            failed.append(sport)
            continue
        week = summary["week"]
        week_label = f"week {week}" if week is not None else "no upcoming week found"
        print(
            f"{summary['sport']} {summary['season']} ({week_label}): "
            f"{summary['predictions_saved']} new predictions saved"
            + (f" ({summary['predictions_deferred']} waiting on a betting line)" if summary["predictions_deferred"] else "")
            + ", "
            + (f"{summary['early_predictions']} early lines, " if summary["early_predictions"] is not None else "")
            + f"{summary['results_reconciled']} results reconciled, "
            f"{summary['market_snapshots']} market prices saved"
        )
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
