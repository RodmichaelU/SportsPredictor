"""FastAPI serving layer over the prediction store.

Every response field name matches frontend/lib/types.ts exactly, so wiring
the frontend to this is a matter of swapping lib/api.ts's mock functions for
fetch calls -- no changes needed in app/ or components/.

Run: uvicorn api.main:app --reload
"""

import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import config
from src import elo, market_history, models, parlay, predict, store
from src.evaluate import expected_calibration_error
from src.models import classification_metrics
from src.odds import kalshi
from src.sports import registry

app = FastAPI(title="SportsPredictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

SPORTS = [
    {"id": "cfb", "name": "College Football", "status": "live"},
    {"id": "nfl", "name": "NFL", "status": "live"},
    {"id": "nba", "name": "NBA", "status": "live"},
    # Ingest + Elo are real and tested for NHL (src/sports/nhl); features.py
    # -- the model layer -- is still a stub, so there's nothing to predict
    # with yet. Listed here so the frontend can show it as a placeholder
    # rather than leaving it undiscoverable.
    {"id": "nhl", "name": "NHL", "status": "coming_soon"},
]


def _prediction_dict(row, market: dict | None = None) -> dict:
    return {
        "game_id": str(row["game_id"]),
        "sport": row["sport"],
        "season": row["season"],
        "week": row["week"],
        "home_team": row["home_team"],
        "away_team": row["away_team"],
        "game_date": row["game_date"],
        "predicted_at": row["predicted_at"],
        "win_probability": row["home_win_prob"],
        "predicted_winner": row["predicted_winner"],
        "predicted_margin": row["predicted_margin"],
        "model_version": row["model_version"],
        "market_home_probability": market["home_probability"] if market else None,
        # "live" (fetched from Kalshi this request) or "snapshot" (the latest
        # price saved by refresh.py, used when Kalshi can't be reached live).
        "market_source": market.get("source") if market else None,
        "market_captured_at": market.get("captured_at") if market else None,
    }


def _result_dict(row) -> dict:
    out = _prediction_dict(row)
    out.update(
        {
            "home_score": row["home_score"],
            "away_score": row["away_score"],
            "actual_winner": row["actual_winner"],
            "actual_margin": row["actual_margin"],
            "hit": bool(row["hit"]),
        }
    )
    return out


@app.get("/sports")
def get_sports():
    return SPORTS


@app.get("/predictions")
def get_predictions(sport: str = "cfb", week: int | None = Query(default=None)):
    conn = store.get_connection()
    query = "SELECT * FROM predictions WHERE sport = ? AND hit IS NULL"
    params = [sport]
    if week is not None:
        query += " AND week = ?"
        params.append(week)
    query += " ORDER BY game_date"
    rows = conn.execute(query, params).fetchall()
    conn.close()

    markets = _market_prices(sport, rows)
    return [_prediction_dict(r, markets.get(str(r["game_id"]))) for r in rows]


# Kalshi's open markets per sport, reused for KALSHI_TTL_SECONDS so a burst
# of requests (every page load, every Parlay Picker rating as legs are
# tapped) costs one Kalshi fetch, not dozens. Failures are cached too, so an
# unreachable Kalshi falls straight through to snapshots instead of timing
# out on every request. refresh.py doesn't go through here and always
# fetches fresh.
KALSHI_TTL_SECONDS = 60
_kalshi_cache: dict[str, tuple[float, dict]] = {}


def _kalshi_index(sport: str) -> dict:
    cached = _kalshi_cache.get(sport)
    if cached and time.monotonic() - cached[0] < KALSHI_TTL_SECONDS:
        return cached[1]
    try:
        index = kalshi.build_index(sport)
    except Exception:
        index = {}
    _kalshi_cache[sport] = (time.monotonic(), index)
    return index


def _market_prices(sport: str, rows) -> dict[str, dict]:
    """game_id -> market price for each prediction row: Kalshi live when it
    matches, otherwise the latest pre-game snapshot refresh.py saved.

    Fetches Kalshi's open markets once and matches every row against that
    same index, rather than one HTTP round-trip per game. Best-effort: a
    Kalshi outage falls back to snapshots instead of taking the endpoint down.
    """
    market_index = _kalshi_index(sport)
    snapshots = market_history.latest_prices(sport)

    prices = {}
    for r in rows:
        game_id = str(r["game_id"])
        live = kalshi.match_game(sport, r["home_team"], r["away_team"], market_index)
        if live:
            prices[game_id] = {**live, "source": "live", "captured_at": None}
        elif game_id in snapshots:
            prices[game_id] = {**snapshots[game_id], "source": "snapshot"}
    return prices


@app.get("/parlays")
def get_parlays(sports: str | None = None, horizon_days: int = Query(default=7, ge=1, le=14)):
    """Parlays at three risk tiers (see src/parlay.py), built from every
    upcoming prediction with a market price. `sports` is a comma-separated
    filter (e.g. "cfb,nfl"); default is every live sport, so legs can mix
    leagues."""
    live = [s["id"] for s in SPORTS if s["status"] == "live"]
    wanted = [s for s in (sports.split(",") if sports else live) if s in live]
    if not wanted:
        raise HTTPException(status_code=400, detail=f"sports must be from: {', '.join(live)}")

    predictions = []
    for sport in wanted:
        predictions.extend(get_predictions(sport, week=None))
    return {"sports": wanted, **parlay.build_parlays(predictions, horizon_days=horizon_days)}


@app.get("/parlay-rating")
def get_parlay_rating(legs: str = Query(..., description="comma-separated sport:game_id:home|away")):
    """Grade a user-built parlay (src/parlay.py rate_parlay). Each leg must be
    an upcoming game with a market price -- the same pool the Parlay Picker's
    tiers draw from."""
    picks = []
    for raw in legs.split(","):
        try:
            sport, game_id, side = raw.strip().split(":")  # game ids never contain ":"
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Bad leg '{raw}': expected sport:game_id:home|away")
        if side not in ("home", "away"):
            raise HTTPException(status_code=400, detail=f"Bad leg '{raw}': side must be home or away")
        picks.append((sport, game_id, side == "home"))

    live = {s["id"] for s in SPORTS if s["status"] == "live"}
    candidates = {}
    for sport in {sport for sport, _, _ in picks}:
        if sport not in live:
            raise HTTPException(status_code=400, detail=f"Unknown sport '{sport}'")
        for leg in parlay.candidate_legs(get_predictions(sport, week=None), datetime.now(timezone.utc), timedelta(days=14)):
            candidates[(leg["sport"], leg["game_id"], leg["is_home"])] = leg

    chosen = []
    for pick in picks:
        if pick not in candidates:
            raise HTTPException(
                status_code=404,
                detail=f"Game {pick[1]} isn't available: it has started, or has no market price.",
            )
        chosen.append(candidates[pick])

    try:
        return parlay.rate_parlay(chosen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/results")
def get_results(sport: str = "cfb", week: int | None = Query(default=None)):
    conn = store.get_connection()
    query = "SELECT * FROM predictions WHERE sport = ? AND hit IS NOT NULL"
    params = [sport]
    if week is not None:
        query += " AND week = ?"
        params.append(week)
    query += " ORDER BY game_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [_result_dict(r) for r in rows]


@app.get("/accuracy")
def get_accuracy(sport: str = "cfb"):
    conn = store.get_connection()
    rows = conn.execute(
        "SELECT home_win_prob, home_team, actual_winner, hit FROM predictions WHERE sport = ? AND hit IS NOT NULL",
        (sport,),
    ).fetchall()
    conn.close()

    if not rows:
        return {"sport": sport, "sample_size": 0, "accuracy": None, "log_loss": None, "brier_score": None, "ece": None}

    y_true = np.array([int(r["actual_winner"] == r["home_team"]) for r in rows])
    y_prob = np.array([r["home_win_prob"] for r in rows])
    hits = [r["hit"] for r in rows]

    metrics = classification_metrics(y_true, y_prob)
    ece = expected_calibration_error(y_true, y_prob)

    return {
        "sport": sport,
        "sample_size": len(rows),
        "accuracy": sum(hits) / len(hits),
        "log_loss": metrics["log_loss"],
        "brier_score": metrics["brier"],
        "ece": ece,
    }


@app.get("/accuracy-by-week")
def get_accuracy_by_week(sport: str = "cfb"):
    """Same hit rate as /accuracy, broken out by (season, week) instead of
    collapsed into one season-to-date number -- shows whether the model is
    trending up, down, or just noisy week to week, which a single
    cumulative figure can't."""
    conn = store.get_connection()
    rows = conn.execute(
        "SELECT season, week, hit FROM predictions WHERE sport = ? AND hit IS NOT NULL ORDER BY season, week",
        (sport,),
    ).fetchall()
    conn.close()

    weeks: dict[tuple[int, int], list] = {}
    for r in rows:
        weeks.setdefault((r["season"], r["week"]), []).append(r["hit"])

    out = [
        {"season": season, "week": week, "sample_size": len(hits), "accuracy": sum(hits) / len(hits)}
        for (season, week), hits in sorted(weeks.items())
    ]
    return {"sport": sport, "weeks": out}


@app.get("/calibration")
def get_calibration(sport: str = "cfb", n_bins: int = 10):
    """Reliability-diagram data: split completed games into n_bins equal-width
    buckets by predicted home win probability, and compare each bucket's
    average prediction against its actual home win rate. A well-calibrated
    model's points sit on the y=x diagonal -- e.g. games the model called
    "70% likely" really should win about 70% of the time. Same 10-bin
    definition as expected_calibration_error, which is why the single ECE
    number on /accuracy and this chart always agree."""
    conn = store.get_connection()
    rows = conn.execute(
        "SELECT home_win_prob, home_team, actual_winner FROM predictions WHERE sport = ? AND hit IS NOT NULL",
        (sport,),
    ).fetchall()
    conn.close()

    if not rows:
        return {"sport": sport, "sample_size": 0, "bins": []}

    y_true = np.array([int(r["actual_winner"] == r["home_team"]) for r in rows])
    y_prob = np.array([r["home_win_prob"] for r in rows])

    edges = np.linspace(0, 1, n_bins + 1)
    bin_ids = np.clip(np.digitize(y_prob, edges) - 1, 0, n_bins - 1)

    bins = []
    for b in range(n_bins):
        mask = bin_ids == b
        if not mask.any():
            continue
        bins.append(
            {
                "bin_start": float(edges[b]),
                "bin_end": float(edges[b + 1]),
                "predicted_mean": float(y_prob[mask].mean()),
                "actual_rate": float(y_true[mask].mean()),
                "count": int(mask.sum()),
            }
        )

    return {"sport": sport, "sample_size": len(rows), "bins": bins}


@app.get("/model-weights")
def get_model_weights(sport: str = "cfb"):
    """Standardized logistic regression coefficients -- what's actually
    driving the win-probability model, in the same units regardless of a
    feature's raw scale. Trains fresh on each call (cheap: a few thousand
    rows, a linear model) rather than persisting a model artifact."""
    features = registry.features_module(sport)
    df = features.load_feature_table()
    pipeline = models.fit_logistic(df[features.FEATURE_COLUMNS], df["home_win"])

    weights = models.logistic_feature_weights(pipeline, features.FEATURE_COLUMNS)
    labels = getattr(features, "FEATURE_LABELS", {})
    for w in weights:
        w["label"] = labels.get(w["feature"], w["feature"])
    weights.sort(key=lambda w: -abs(w["weight"]))

    return {
        "sport": sport,
        "model_version": getattr(features, "MODEL_VERSION", predict.MODEL_VERSION),
        "trained_on_games": len(df),
        "weights": weights,
    }


@app.get("/model-curve")
def get_model_curve(sport: str = "cfb", feature: str = Query(...), target: str = "win"):
    """Partial-dependence curve for one feature: the model's actual
    prediction as that feature sweeps across its observed range, every
    other feature held at its historical median, plus a sample of real
    historical data points for context. target="win" traces the logistic
    regression's sigmoid; target="margin" traces the ridge regressor's
    line (genuinely linear, since ridge is a linear model)."""
    features = registry.features_module(sport)
    if feature not in features.FEATURE_COLUMNS:
        raise HTTPException(status_code=404, detail=f"Unknown feature: {feature}")

    df = features.load_feature_table()

    if target == "margin":
        pipeline = models.fit_ridge(df[features.FEATURE_COLUMNS], df["margin"])
        scatter_target, jitter = "margin", False
    else:
        pipeline = models.fit_logistic(df[features.FEATURE_COLUMNS], df["home_win"])
        scatter_target, jitter = "home_win", True

    curve = models.partial_dependence_curve(pipeline, features.FEATURE_COLUMNS, df, feature)
    scatter = models.scatter_sample(df, feature, scatter_target, jitter=jitter)

    labels = getattr(features, "FEATURE_LABELS", {})
    return {
        "sport": sport,
        "feature": feature,
        "label": labels.get(feature, feature),
        "target": target,
        "curve": curve,
        "scatter": scatter,
    }


def _fmt(value: float) -> str:
    return f"{value:.0f}" if abs(value) >= 10 else f"{value:.2f}"


def _is_missing(value) -> bool:
    return value is None or (isinstance(value, float) and np.isnan(value))


def _feature_detail_line(feature: str, label: str, home_team: str, away_team: str, game_row) -> str:
    if feature == "closing_spread":
        spread = game_row.get("closing_spread")
        if _is_missing(spread):
            return "No line available"
        favored = home_team if spread < 0 else away_team
        return f"{favored} favored by {abs(spread):.1f} points"
    if feature in ("neutral_site", "conference_game", "div_game"):
        return f"{label}: {'Yes' if game_row.get(feature) else 'No'}"
    if feature == "h2h_margin":
        margin, meetings = game_row.get("h2h_margin"), game_row.get("h2h_games")
        if _is_missing(margin) or not meetings:
            return "No meetings this season or last"
        leader = home_team if margin >= 0 else away_team
        plural = "s" if meetings != 1 else ""
        return f"Last {int(meetings)} meeting{plural}: {leader} by {abs(margin):.1f} on average"
    if feature == "missing_eff_diff":
        sides = []
        for team, prefix in ((home_team, "home"), (away_team, "away")):
            names = game_row.get(f"{prefix}_missing_players")
            value = game_row.get(f"{prefix}_missing_eff")
            if not names or _is_missing(value):
                sides.append(f"{team}: no one out")
            else:
                sides.append(f"{team} out: {names} ({value:.0f} EFF/game)")
        return "; ".join(sides)

    pair = models.raw_value_pair(feature, game_row)
    if pair is None or any(_is_missing(v) for v in pair):
        return f"{label}: not enough data yet for one or both teams"
    home_val, away_val = pair
    short_label = label.replace(" gap", "").replace(" (offense)", "").replace(" (defense)", "")
    return f"{short_label}: {home_team} {_fmt(home_val)} vs {away_team} {_fmt(away_val)}"


@app.get("/explain")
def get_explain(sport: str = "cfb", game_id: str = Query(...)):
    """Per-game breakdown of a frozen prediction, grouped by feature family
    (api/../src/sports/<sport>/features.py's FEATURE_GROUPS).

    Since the win-probability model is logistic regression, each feature's
    contribution to the predicted log-odds is exact -- they sum to the
    actual prediction, unlike SHAP-style approximations for nonlinear
    models. But several of these features are correlated with each other
    (e.g. CFB's SP+ overall/offense/defense ratings), and a correlated
    input's individual coefficient can point the opposite way you'd
    naively expect (more offense intuitively helps, but SP+ offense's
    global weight is negative once SP+ overall is also in the model) even
    though the total is still correct. Grouping correlated families into
    one net number sidesteps that: the combined effect of "SP+ ratings" as
    a whole is far more likely to match intuition than any one collinear
    sub-term."""
    conn = store.get_connection()
    row = conn.execute(
        "SELECT * FROM predictions WHERE sport = ? AND game_id = ?", (sport, game_id)
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="No prediction on record for this game")

    features = registry.features_module(sport)
    # hit IS NULL only means "reconcile.py hasn't scored this yet", not "the
    # game hasn't been played" -- a game can finish in the real world before
    # we get around to running reconcile.py for that sport. Try the
    # not-yet-played path first (cheap, and correct for the common case),
    # then fall back to rebuilding from the season's historical features
    # (which works once the game has a final score) if the game isn't found
    # there.
    game_table = features.build_upcoming_features(row["season"], row["week"])
    if not game_table.empty:
        game_table = game_table[game_table["game_id"].astype(str) == game_id]
    if game_table.empty:
        game_table = features.build_season_features(row["season"])
        game_table = game_table[game_table["game_id"].astype(str) == game_id]
    if game_table.empty:
        raise HTTPException(status_code=404, detail="Could not rebuild features for this game")
    game_row = features.add_model_features(game_table).iloc[0]

    history = features.load_feature_table()
    pipeline = models.fit_logistic(history[features.FEATURE_COLUMNS], history["home_win"])
    result = models.logistic_contributions(
        pipeline, features.FEATURE_COLUMNS, game_row[features.FEATURE_COLUMNS].to_frame().T
    )
    contributions = result["contributions"]

    labels = getattr(features, "FEATURE_LABELS", {})
    home_team, away_team = row["home_team"], row["away_team"]

    groups = []
    for group in features.FEATURE_GROUPS:
        group_contribution = sum(contributions[f] for f in group["features"])
        details = [
            _feature_detail_line(f, labels.get(f, f), home_team, away_team, game_row)
            for f in group["features"]
        ]
        # The betting market has an objective, external meaning independent
        # of this model (a -3 spread means the home team is favored, full
        # stop), unlike the other groups where "favors" only ever meant
        # "this model's contribution leans that way." Standardized
        # coefficients are centered on the training data's *average* spread
        # (a fairly steep favorite, since CFB schedules include lots of
        # blowout non-conference games) -- so a modest favorite can show a
        # negative contribution purely for being a weaker favorite than
        # usual, which would read as a flat contradiction against the
        # spread shown right next to it. Use the spread's own sign here.
        if group["key"] == "market" and not _is_missing(game_row.get("closing_spread")):
            favored_team = home_team if game_row["closing_spread"] < 0 else away_team
        else:
            favored_team = home_team if group_contribution >= 0 else away_team

        groups.append(
            {
                "key": group["key"],
                "label": group["label"],
                "contribution": group_contribution,
                "favored_team": favored_team,
                "details": details,
            }
        )
    groups.sort(key=lambda g: -abs(g["contribution"]))

    market = _market_prices(sport, [row]).get(str(game_id))

    return {
        "sport": sport,
        "game_id": game_id,
        "home_team": home_team,
        "away_team": away_team,
        "predicted_winner": row["predicted_winner"],
        "win_probability": row["home_win_prob"],
        "model_version": row["model_version"],
        "groups": groups,
        "market_home_probability": market["home_probability"] if market else None,
        # "live" (fetched from Kalshi this request) or "snapshot" (the latest
        # price saved by refresh.py, used when Kalshi can't be reached live).
        "market_source": market.get("source") if market else None,
        "market_captured_at": market.get("captured_at") if market else None,
    }


@app.get("/team-logos")
def get_team_logos(sport: str = "cfb"):
    """team name/code -> logo URL. Sourced straight from each sport's data
    provider (CFBD's /teams, nflreadpy's load_teams()) rather than hosting
    logo assets ourselves -- free, no licensing/asset-management burden, and
    matches this project's "free resources only" constraint. nhl has no
    team_logos() yet (its ingest module predates this), so it safely falls
    back to an empty map instead of erroring."""
    ingest = registry.ingest_module(sport)
    logos_fn = getattr(ingest, "team_logos", None)
    return logos_fn() if logos_fn else {}


@app.get("/standings")
def get_standings(sport: str = "cfb", season: int = Query(default=None)):
    """Win-loss records for the season, grouped by conference (NFL:
    conference + division). Sourced from each sport's ingest module's
    standings() -- derived from the same load_games() every other win/loss
    count in this app uses, so a team's record here always matches its
    record shown on its own team page. nhl has no standings() yet, so it
    safely falls back to no groups instead of erroring."""
    season = season or config.CURRENT_SEASON
    ingest = registry.ingest_module(sport)
    standings_fn = getattr(ingest, "standings", None)
    if not standings_fn:
        return {"sport": sport, "season": season, "groups": []}

    rows = standings_fn(season)

    groups: dict[str, list[dict]] = {}
    for r in rows:
        # nflverse's team_division is already "AFC East"-style (conference
        # prefix included), so it doubles as the full group key on its own.
        if sport == "nfl" and r.get("division"):
            key = r["division"]
        else:
            key = r.get("conference") or "Independent / Other"
        groups.setdefault(key, []).append(r)

    def win_pct(r: dict) -> float:
        games = r["wins"] + r["losses"]
        return r["wins"] / games if games > 0 else 0.0

    result_groups = []
    for key, teams in groups.items():
        teams.sort(key=lambda t: (-win_pct(t), -t["wins"]))
        result_groups.append(
            {
                "group": key,
                "teams": [{"team": t["team"], "wins": t["wins"], "losses": t["losses"]} for t in teams],
            }
        )
    result_groups.sort(key=lambda g: g["group"])

    return {"sport": sport, "season": season, "groups": result_groups}


@app.get("/teams")
def get_teams(sport: str = "cfb"):
    """Every team with at least one frozen prediction on record for this
    sport -- i.e. every team a /team lookup will actually return something
    for, rather than every team in the raw schedule (most of which have
    never been predicted, since predict.py/refresh.py only ever freeze the
    nearest upcoming week)."""
    conn = store.get_connection()
    rows = conn.execute(
        "SELECT DISTINCT home_team AS team FROM predictions WHERE sport = ? "
        "UNION SELECT DISTINCT away_team AS team FROM predictions WHERE sport = ? "
        "ORDER BY team",
        (sport, sport),
    ).fetchall()
    conn.close()
    return [r["team"] for r in rows]


@app.get("/team")
def get_team(sport: str = "cfb", team: str = Query(...)):
    """Everything we know about one team: every game it's had a frozen
    prediction for (reused from the predictions store, not re-derived from
    the raw schedule -- see /teams), its record, and its Elo rating
    trajectory through the current season.

    The record and Elo come from the sport's completed games, not the
    predictions store, so a team with no frozen predictions yet (e.g. any
    team linked from /standings early on) still gets a page, and its record
    matches /standings exactly. 404 only for a team that has neither."""
    conn = store.get_connection()
    rows = conn.execute(
        "SELECT * FROM predictions WHERE sport = ? AND (home_team = ? OR away_team = ?) ORDER BY game_date",
        (sport, team, team),
    ).fetchall()
    conn.close()

    ingest = registry.ingest_module(sport)
    all_games = ingest.load_games(config.START_SEASON, config.CURRENT_SEASON)
    if not rows and not ((all_games["home_team"] == team) | (all_games["away_team"] == team)).any():
        raise HTTPException(status_code=404, detail="No games on record for this team")

    markets = _market_prices(sport, [r for r in rows if r["hit"] is None])

    games = []
    for r in rows:
        game = _prediction_dict(r, markets.get(str(r["game_id"])))
        game.update(
            {
                "home_score": r["home_score"],
                "away_score": r["away_score"],
                "actual_winner": r["actual_winner"],
                "actual_margin": r["actual_margin"],
                "hit": bool(r["hit"]) if r["hit"] is not None else None,
            }
        )
        games.append(game)

    # Elo rating trajectory: re-simulate the whole sport (elo.py is cheap --
    # a plain dict-update loop, not a model fit) with this sport's already
    # tuned K/home-field advantage, then keep only this team's current-season
    # games. Kept separate from the predictions-store loop above because Elo
    # ratings depend on the full chronological game sequence, not just this
    # team's games.
    k = getattr(ingest, "ELO_K")
    hfa = getattr(ingest, "ELO_HOME_ADVANTAGE")
    sim = elo.simulate(all_games, k, hfa)
    sim = sim.merge(all_games[["game_id", "start_date"]], on="game_id", how="left")

    team_sim = sim[
        (sim["season"] == config.CURRENT_SEASON) & ((sim["home_team"] == team) | (sim["away_team"] == team))
    ].sort_values("start_date")

    elo_history = []
    for r in team_sim.itertuples():
        is_home = r.home_team == team
        pregame = r.home_pregame_elo if is_home else r.away_pregame_elo
        team_result = r.home_win if is_home else 1 - r.home_win
        team_prob = r.home_win_prob if is_home else 1 - r.home_win_prob
        postgame = pregame + k * (team_result - team_prob)
        elo_history.append(
            {
                "game_date": r.start_date,
                "opponent": r.away_team if is_home else r.home_team,
                "rating_before": pregame,
                "rating_after": postgame,
            }
        )

    current_elo = elo_history[-1]["rating_after"] if elo_history else None
    wins = sum(1 for r in team_sim.itertuples() if (r.home_win == 1) == (r.home_team == team))
    losses = len(team_sim) - wins

    return {
        "sport": sport,
        "team": team,
        "record": {"wins": wins, "losses": losses},
        "current_elo": current_elo,
        "elo_history": elo_history,
        "games": games,
    }
