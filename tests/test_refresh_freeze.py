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
