"""Logistic regression + gradient boosting for win probability; ridge +
gradient boosting for margin. Temporal split: train on seasons before the
test season, test on the held-out season, printed side by side with Elo.

Run: python -m src.models [--test-season YEAR]
"""

import argparse

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, RidgeCV
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    log_loss,
    mean_absolute_error,
    mean_squared_error,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor

import config
from src import elo

# Diff features (home - away) for symmetric matchup modeling, plus a few
# game-context fields that aren't team-specific. All pre-game per features.py.
DIFF_BASES = [
    "off_ppa", "off_success_rate", "off_explosiveness", "off_points_per_drive",
    "def_ppa", "def_success_rate", "def_explosiveness", "def_points_per_drive",
    "rest_days", "talent", "sp_rating", "sp_offense", "sp_defense",
]
FEATURE_COLUMNS = ["elo_diff"] + [f"{b}_diff" for b in DIFF_BASES] + [
    "closing_spread", "neutral_site", "conference_game",
]


def load_feature_table() -> pd.DataFrame:
    df = pd.read_parquet(config.PROCESSED_DIR / "features.parquet")
    df["elo_diff"] = df["home_pregame_elo"] - df["away_pregame_elo"]
    for base in DIFF_BASES:
        df[f"{base}_diff"] = df[f"home_{base}"] - df[f"away_{base}"]
    df["neutral_site"] = df["neutral_site"].astype(int)
    df["conference_game"] = df["conference_game"].astype(int)
    return df


def temporal_split(df: pd.DataFrame, test_season: int):
    train = df[df["season"] < test_season]
    test = df[df["season"] == test_season]
    return train, test


def fit_logistic(X_train, y_train) -> Pipeline:
    pipe = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(penalty="l2", max_iter=1000)),
        ]
    )
    pipe.fit(X_train, y_train)
    return pipe


def fit_xgb_classifier(X_train, y_train) -> XGBClassifier:
    clf = XGBClassifier(
        n_estimators=300,
        max_depth=3,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=42,
    )
    clf.fit(X_train, y_train)
    return clf


def fit_ridge(X_train, y_train) -> Pipeline:
    pipe = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("reg", RidgeCV(alphas=np.logspace(-3, 3, 25))),
        ]
    )
    pipe.fit(X_train, y_train)
    return pipe


def fit_xgb_regressor(X_train, y_train) -> XGBRegressor:
    reg = XGBRegressor(
        n_estimators=300,
        max_depth=3,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    reg.fit(X_train, y_train)
    return reg


def classification_metrics(y_true, y_prob) -> dict:
    y_prob = np.clip(y_prob, 1e-6, 1 - 1e-6)
    return {
        "log_loss": log_loss(y_true, y_prob),
        "brier": brier_score_loss(y_true, y_prob),
        "auc": roc_auc_score(y_true, y_prob),
        "accuracy": accuracy_score(y_true, (y_prob > 0.5).astype(int)),
    }


def regression_metrics(y_true, y_pred) -> dict:
    return {
        "mae": mean_absolute_error(y_true, y_pred),
        "rmse": mean_squared_error(y_true, y_pred) ** 0.5,
    }


def elo_metrics_for_season(test_season: int, start_season: int) -> dict:
    games = elo.load_games(start_season, test_season)
    predictions = elo.simulate(games, elo.TUNED_K, elo.TUNED_HOME_ADVANTAGE)
    test_predictions = predictions[predictions["season"] == test_season]
    return classification_metrics(test_predictions["home_win"], test_predictions["home_win_prob"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-season", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    df = load_feature_table()
    train, test = temporal_split(df, args.test_season)

    X_train, y_train_win = train[FEATURE_COLUMNS], train["home_win"]
    X_test, y_test_win = test[FEATURE_COLUMNS], test["home_win"]
    y_train_margin, y_test_margin = train["margin"], test["margin"]

    logistic = fit_logistic(X_train, y_train_win)
    xgb_clf = fit_xgb_classifier(X_train, y_train_win)
    ridge = fit_ridge(X_train, y_train_margin)
    xgb_reg = fit_xgb_regressor(X_train, y_train_margin)

    win_results = {
        "Elo (baseline)": elo_metrics_for_season(args.test_season, config.START_SEASON),
        "Logistic Regression": classification_metrics(y_test_win, logistic.predict_proba(X_test)[:, 1]),
        "XGBoost Classifier": classification_metrics(y_test_win, xgb_clf.predict_proba(X_test)[:, 1]),
    }

    print(f"Win probability metrics on held-out season {args.test_season}:")
    print(f"{'model':<22}{'log_loss':>10}{'brier':>10}{'auc':>10}{'accuracy':>10}")
    for name, m in win_results.items():
        print(f"{name:<22}{m['log_loss']:>10.4f}{m['brier']:>10.4f}{m['auc']:>10.4f}{m['accuracy']:>10.4f}")

    margin_results = {
        "Ridge": regression_metrics(y_test_margin, ridge.predict(X_test)),
        "XGBoost Regressor": regression_metrics(y_test_margin, xgb_reg.predict(X_test)),
    }
    print(f"\nMargin metrics on held-out season {args.test_season}:")
    print(f"{'model':<22}{'mae':>10}{'rmse':>10}")
    for name, m in margin_results.items():
        print(f"{name:<22}{m['mae']:>10.4f}{m['rmse']:>10.4f}")


if __name__ == "__main__":
    main()
