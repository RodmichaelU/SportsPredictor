"""NHL feature engineering -- NOT YET IMPLEMENTED.

This is the piece deliberately deferred from the "architecture ready" pass
(see README's Status section). src/sports/nhl/ingest.py's load_games() is
real and tested, so `python -m src.elo --sport nhl` already works
end-to-end; this file is what a full build needs to add next to get
predict.py/models.py/evaluate.py working for NHL too.

To implement, follow src/sports/nfl/features.py as the structural
reference, with one real difference from every other sport built so far:
NHL's schedule endpoint (ingest.py's club-schedule-season, what load_games
uses) only carries the final score, not team stats -- unlike NBA's
LeagueGameFinder or CFB's/NFL's dedicated stats endpoints. Team stats live
on a *per-game* boxscore endpoint instead: confirmed live while building
this, GET https://api-web.nhle.com/v1/gamecenter/<game_id>/boxscore returns
a `playerByGameStats` block with team-level shots/hits/faceoff stats
derivable from it. That means building the rolling-stat input requires one
extra API call per historical game (thousands of calls for a multi-season
range) rather than one call per team-season the way ingest.py's
load_games() works today -- worth designing a real caching strategy for
before ingesting broadly, the same "API budget" discipline CLAUDE.md
already asks CFB's client.py to follow.

  1. FEATURE_COLUMNS: list[str] -- likely candidates from the boxscore
     endpoint: shots on goal, faceoff win %, hits, power-play conversions.
     Build home-minus-away diff columns from these, the way every other
     sport does.
  2. A leak-free rolling-average helper -- expanding mean shifted by one
     game, sorted by actual date. See src/sports/cfb/features.py's
     season_to_date_stats for the reference implementation, and
     tests/test_leakage_cfb.py for how it's verified against hand
     recomputation.
  3. FEATURE_LABELS: dict[str, str] -- human-readable labels for the
     frontend's model-weights and per-game explanation views.
  4. FEATURE_GROUPS: list[dict] -- only needed if some features end up
     correlated with each other (see src/sports/cfb/features.py's docstring
     on why SP+ overall/offense/defense needed grouping). Check before
     adding this complexity.
  5. build_season_features(season) / build_upcoming_features(season, week) --
     NHL has no CFBD-style pregame Elo field, so pregame Elo should come
     from our own elo.py the way src/sports/nfl/features.py does it
     (_elo_ratings_for_range), not from an external source. NHL also has no
     "week" concept (games are date-scheduled across an ~82-game season,
     see the note in ingest.py's load_games) -- the `week` parameter here
     needs an actual design decision (a date range? a single day's slate?),
     not a blind copy of the CFB/NFL function signature.
  6. add_model_features(df) / load_feature_table() -- same pattern as every
     other sport; see src/sports/nfl/features.py for the shortest version.
  7. tests/test_leakage_nhl.py mirroring test_leakage_cfb.py /
     test_leakage_nfl.py -- non-negotiable per CLAUDE.md's leakage rule,
     not optional polish.
  8. Add "nhl" to api/main.py's SPORTS list only once all of the above
     actually works end to end (registry.py's SPORTS already includes it,
     which is a separate list -- that one just controls what --sport CLI
     flags are valid, not what the live frontend shows).

Nothing below here works yet -- every function raises NotImplementedError
pointing back to this docstring rather than failing with a bare
AttributeError somewhere downstream.
"""

FEATURE_COLUMNS: list[str] = []
FEATURE_LABELS: dict[str, str] = {}
FEATURE_GROUPS: list[dict] = []

_NOT_IMPLEMENTED = (
    "NHL feature engineering isn't built yet -- see the module docstring in "
    "src/sports/nhl/features.py for what's needed. "
    "src/sports/nhl/ingest.py's load_games() already works, so "
    "`python -m src.elo --sport nhl` runs fine on its own."
)


def load_feature_table():
    raise NotImplementedError(_NOT_IMPLEMENTED)


def build_features(start_season: int, end_season: int):
    raise NotImplementedError(_NOT_IMPLEMENTED)


def build_season_features(season: int):
    raise NotImplementedError(_NOT_IMPLEMENTED)


def build_upcoming_features(season: int, week: int):
    raise NotImplementedError(_NOT_IMPLEMENTED)


def add_model_features(df):
    raise NotImplementedError(_NOT_IMPLEMENTED)
