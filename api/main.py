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
from fastapi import FastAPI, Query
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
