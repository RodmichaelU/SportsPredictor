"""refresh.py's freeze gate: a prediction missing an input its sport needs
before freezing (e.g. the betting line) waits for a later run, unless
kickoff is within FREEZE_FALLBACK -- then it freezes anyway rather than
leaving the game without a pick."""

from datetime import datetime, timedelta, timezone

from src.refresh import FREEZE_FALLBACK, _ready_to_freeze

NOW = datetime(2026, 11, 10, 18, 0, tzinfo=timezone.utc)


def _row(game_id, hours_ahead, missing):
    start = NOW + timedelta(hours=hours_ahead)
    return {"game_id": game_id, "game_date": start.isoformat().replace("+00:00", "Z"), "missing_inputs": missing}


def test_complete_rows_freeze_immediately():
    ready, deferred = _ready_to_freeze([_row("a", 96, [])], NOW)
    assert [r["game_id"] for r in ready] == ["a"] and deferred == 0


def test_rows_missing_the_line_wait_until_close_to_kickoff():
    far = _row("far", 96, ["closing_spread"])
    near = _row("near", FREEZE_FALLBACK.total_seconds() / 3600 - 1, ["closing_spread"])
    ready, deferred = _ready_to_freeze([far, near], NOW)
    assert [r["game_id"] for r in ready] == ["near"]
    assert deferred == 1


def test_sports_without_freeze_requirements_are_unaffected():
    # NBA rows carry an empty missing_inputs list (no FREEZE_REQUIRES).
    ready, deferred = _ready_to_freeze([_row("nba", 10, [])], NOW)
    assert len(ready) == 1 and deferred == 0


def test_early_window_covers_only_games_past_the_freeze_horizon():
    from src.refresh import _early_window

    rows = [_row("frozen-soon", 6, []), _row("tomorrow", 24, []), _row("too-far", 60, []), _row("started", -1, [])]
    early = _early_window(rows, NOW, timedelta(hours=12), timedelta(hours=36))
    assert [r["game_id"] for r in early] == ["tomorrow"]


def test_cfb_refresh_stays_inside_the_free_api_budget():
    # 8 runs/day (every 3 hours) for a 31-day month must stay under CFBD's
    # 1,000 calls with headroom for manual runs.
    from src.refresh import CFB_CACHE_MAX_AGE

    runs_per_day = 8
    calls_per_day = sum(
        runs_per_day if age == timedelta(0) else max(1, round(timedelta(days=1) / age)) if age < timedelta(days=1) else 1 / age.days
        for age in CFB_CACHE_MAX_AGE.values()
    )
    assert calls_per_day * 31 < 800
