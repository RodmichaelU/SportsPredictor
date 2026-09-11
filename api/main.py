"""FastAPI serving layer over the prediction store.

Every response field name matches frontend/lib/types.ts exactly, so wiring
the frontend to this is a matter of swapping lib/api.ts's mock functions for
fetch calls -- no changes needed in app/ or components/.

Run: uvicorn api.main:app --reload
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from src import models, predict, store
from src.evaluate import expected_calibration_error
from src.models import classification_metrics
from src.sports import registry

app = FastAPI(title="SportsPredictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

SPORTS = [
    {"id": "cfb", "name": "College Football"},
    {"id": "nfl", "name": "NFL"},
]


def _prediction_dict(row) -> dict:
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
    return [_prediction_dict(r) for r in rows]


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
        "model_version": predict.MODEL_VERSION,
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

    return {
        "sport": sport,
        "game_id": game_id,
        "home_team": home_team,
        "away_team": away_team,
        "predicted_winner": row["predicted_winner"],
        "win_probability": row["home_win_prob"],
        "model_version": row["model_version"],
        "groups": groups,
    }
