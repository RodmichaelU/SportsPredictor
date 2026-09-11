"""Logistic regression + gradient boosting for win probability; ridge +
gradient boosting for margin. Temporal split: train on seasons before the
test season, test on the held-out season, printed side by side with Elo.

Sport-agnostic: every function here takes a plain X/y (numpy arrays or a
DataFrame slice) and knows nothing about which sport or which named columns
produced them. main() is the only place that knows about sports at all, and
it only knows the registry -- a new sport's features module (FEATURE_COLUMNS
+ load_feature_table()) is the entire integration surface.

Run: python -m src.models [--sport cfb] [--test-season YEAR]
"""

import argparse

import numpy as np
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
from src.sports import registry


def temporal_split(df, test_season: int):
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


def logistic_feature_weights(pipeline: Pipeline, feature_columns: list) -> list:
    """Standardized logistic regression coefficients: since StandardScaler
    runs before the classifier in the pipeline, these are already comparable
    across features on wildly different raw scales (e.g. elo_diff spans
    hundreds of points, closing_spread spans dozens, neutral_site is 0/1) --
    a bigger |coefficient| means a one-standard-deviation swing in that
    feature moves the predicted log-odds more, which is what "driving the
    model" means for a linear model like this one."""
    coefs = pipeline.named_steps["clf"].coef_[0]
    return [
        {"feature": col, "weight": float(w)}
        for col, w in zip(feature_columns, coefs)
    ]


def logistic_contributions(pipeline: Pipeline, feature_columns: list, X_row) -> dict:
    """Exact per-feature breakdown of one game's prediction: since logistic
    regression is linear in log-odds, log_odds = intercept + sum(coef_i *
    scaled_feature_i), so each term's contribution to that sum is well
    defined -- not an approximation the way SHAP values are for nonlinear
    models. X_row is a single-row DataFrame slice with feature_columns."""
    imputer = pipeline.named_steps["impute"]
    scaler = pipeline.named_steps["scale"]
    clf = pipeline.named_steps["clf"]

    X_scaled = scaler.transform(imputer.transform(X_row))
    contributions = X_scaled[0] * clf.coef_[0]
    return {
        "intercept": float(clf.intercept_[0]),
        "contributions": {col: float(c) for col, c in zip(feature_columns, contributions)},
    }


def raw_value_pair(feature: str, row) -> tuple | None:
    """For a "_diff" feature, the (home_value, away_value) pair it was
    computed from, e.g. "sp_rating_diff" -> (row.home_sp_rating,
    row.away_sp_rating). Every sport's features.py follows this
    home_<base>/away_<base> naming convention (elo_diff is the one
    exception: the raw columns are home_pregame_elo/away_pregame_elo).
    Returns None for features with no home/away split (closing_spread,
    neutral_site, ...) -- those are single shared values, not a comparison."""
    if not feature.endswith("_diff"):
        return None
    base = feature[: -len("_diff")]
    home_col, away_col = (
        ("home_pregame_elo", "away_pregame_elo") if base == "elo" else (f"home_{base}", f"away_{base}")
    )
    if home_col not in row.index or away_col not in row.index:
        return None
    return row[home_col], row[away_col]


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


def elo_metrics_for_season(sport: str, test_season: int, start_season: int) -> dict:
    ingest = registry.ingest_module(sport)
    games = ingest.load_games(start_season, test_season)
    predictions = elo.simulate(games, ingest.ELO_K, ingest.ELO_HOME_ADVANTAGE)
    test_predictions = predictions[predictions["season"] == test_season]
    return classification_metrics(test_predictions["home_win"], test_predictions["home_win_prob"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sport", default="cfb", choices=registry.SPORTS)
    parser.add_argument("--test-season", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    features = registry.features_module(args.sport)
    df = features.load_feature_table()
    train, test = temporal_split(df, args.test_season)

    X_train, y_train_win = train[features.FEATURE_COLUMNS], train["home_win"]
    X_test, y_test_win = test[features.FEATURE_COLUMNS], test["home_win"]
    y_train_margin, y_test_margin = train["margin"], test["margin"]

    logistic = fit_logistic(X_train, y_train_win)
    xgb_clf = fit_xgb_classifier(X_train, y_train_win)
    ridge = fit_ridge(X_train, y_train_margin)
    xgb_reg = fit_xgb_regressor(X_train, y_train_margin)

    win_results = {
        "Elo (baseline)": elo_metrics_for_season(args.sport, args.test_season, config.START_SEASON),
        "Logistic Regression": classification_metrics(y_test_win, logistic.predict_proba(X_test)[:, 1]),
        "XGBoost Classifier": classification_metrics(y_test_win, xgb_clf.predict_proba(X_test)[:, 1]),
    }

    print(f"Win probability metrics on held-out season {args.test_season} ({args.sport}):")
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
