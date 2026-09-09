"""Log loss, Brier, calibration curves, and comparison against the closing
line converted to an implied win probability -- the real test. Beating Elo
is the floor; matching or beating the market is a genuinely high bar.

Sport-agnostic like models.py, with one assumption baked in: every sport's
feature table includes a "closing_spread" column (home-team-referenced) for
the market comparison. cfb and nfl both satisfy this.

Run: python -m src.evaluate [--sport cfb] [--test-season YEAR]
"""

import argparse

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.linear_model import LogisticRegression

import config
from src import elo, models
from src.sports import registry


def fit_market_model(train: pd.DataFrame) -> LogisticRegression:
    """Fit a spread -> win probability mapping on training seasons only. The
    standard way to turn a point spread into an implied probability when
    moneylines aren't reliably available (~51% coverage here vs. ~99% for
    spreads): a 1-feature logistic regression of the historical relationship
    between closing spread and actual outcome."""
    rows = train.dropna(subset=["closing_spread"])
    clf = LogisticRegression()
    clf.fit(rows[["closing_spread"]], rows["home_win"])
    return clf


def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    bins = np.linspace(0, 1, n_bins + 1)
    bin_ids = np.clip(np.digitize(y_prob, bins) - 1, 0, n_bins - 1)
    n = len(y_true)
    ece = 0.0
    for b in range(n_bins):
        mask = bin_ids == b
        if not mask.any():
            continue
        ece += (mask.sum() / n) * abs(y_true[mask].mean() - y_prob[mask].mean())
    return ece


def plot_calibration(predictions: dict, out_path):
    plt.figure(figsize=(6, 6))
    plt.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Perfectly calibrated")
    for name, (y_true, y_prob) in predictions.items():
        frac_pos, mean_pred = calibration_curve(y_true, y_prob, n_bins=8, strategy="quantile")
        plt.plot(mean_pred, frac_pos, marker="o", label=name)
    plt.xlabel("Predicted win probability")
    plt.ylabel("Actual win rate")
    plt.legend()
    plt.title("Calibration: predicted vs. actual")
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def build_predictions(sport: str, test_season: int) -> dict:
    """Returns {model_name: (y_true, y_prob)}, all restricted to the games in
    the held-out season that have a closing line, so the comparison against
    the market is apples-to-apples rather than comparing full-season metrics
    against a smaller market-only subset."""
    features = registry.features_module(sport)
    df = features.load_feature_table()
    train, test = models.temporal_split(df, test_season)
    train, test = train.set_index("game_id"), test.set_index("game_id")

    test_with_spread = test.dropna(subset=["closing_spread"])
    ids = test_with_spread.index

    X_train, y_train_win = train[features.FEATURE_COLUMNS], train["home_win"]
    logistic = models.fit_logistic(X_train, y_train_win)
    xgb_clf = models.fit_xgb_classifier(X_train, y_train_win)
    market = fit_market_model(train)

    X_test = test_with_spread[features.FEATURE_COLUMNS]
    y_test = test_with_spread["home_win"].values

    sport_ingest = registry.ingest_module(sport)
    games_elo = sport_ingest.load_games(config.START_SEASON, test_season)
    elo_predictions = elo.simulate(games_elo, sport_ingest.ELO_K, sport_ingest.ELO_HOME_ADVANTAGE)
    elo_test = elo_predictions[elo_predictions["season"] == test_season].set_index("game_id")
    elo_aligned = elo_test.loc[ids]

    return {
        "Elo": (elo_aligned["home_win"].values, elo_aligned["home_win_prob"].values),
        "Logistic Regression": (y_test, logistic.predict_proba(X_test)[:, 1]),
        "XGBoost": (y_test, xgb_clf.predict_proba(X_test)[:, 1]),
        "Market (closing spread)": (
            y_test,
            market.predict_proba(test_with_spread[["closing_spread"]])[:, 1],
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sport", default="cfb", choices=registry.SPORTS)
    parser.add_argument("--test-season", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    predictions = build_predictions(args.sport, args.test_season)
    n = len(next(iter(predictions.values()))[0])

    print(f"Evaluation on held-out season {args.test_season} ({args.sport}, {n} games with a closing line):\n")
    print(f"{'model':<26}{'log_loss':>10}{'brier':>10}{'auc':>10}{'accuracy':>10}{'ece':>10}")
    market_log_loss = None
    for name, (y_true, y_prob) in predictions.items():
        m = models.classification_metrics(y_true, y_prob)
        ece = expected_calibration_error(np.asarray(y_true), np.asarray(y_prob))
        print(f"{name:<26}{m['log_loss']:>10.4f}{m['brier']:>10.4f}{m['auc']:>10.4f}{m['accuracy']:>10.4f}{ece:>10.4f}")
        if name == "Market (closing spread)":
            market_log_loss = m["log_loss"]

    print(f"\nVs. market on log loss (lower is better; market = {market_log_loss:.4f}):")
    for name, (y_true, y_prob) in predictions.items():
        if name == "Market (closing spread)":
            continue
        log_loss = models.classification_metrics(y_true, y_prob)["log_loss"]
        verdict = "beats" if log_loss < market_log_loss else "loses to"
        print(f"  {name}: {log_loss:.4f} ({verdict} the market)")

    out_path = config.PROCESSED_DIR / f"calibration_{args.sport}_{args.test_season}.png"
    plot_calibration(predictions, out_path)
    print(f"\nCalibration curve saved to {out_path}")


if __name__ == "__main__":
    main()
