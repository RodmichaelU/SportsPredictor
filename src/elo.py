"""From-scratch Elo rating system: the reference baseline every later model
(logistic regression, gradient boosting) has to beat to justify its added
complexity.

Sport-agnostic: operates only on the common games schema (season, week,
start_date, home_team, away_team, neutral_site, home_points, away_points,
home_win) that every src.sports.<id>.ingest module's load_games() produces.
Adding a sport never requires touching this file.

Ratings update sequentially, game by game in chronological order, so each
prediction only ever uses information from strictly earlier games -- no
train/test split is needed for the simulation itself (it's inherently
online), but K and home-field advantage are tuned on an earlier stretch of
seasons and evaluated on a held-out most-recent season, consistent with the
walk-forward approach the rest of the plan uses.

Run: python -m src.elo [--sport cfb]
"""

import argparse
import itertools

import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss

import config
from src.sports import registry

INITIAL_RATING = 1500.0
SEASON_CARRYOVER = 0.75  # fraction of a team's rating-above-mean kept into the next season

# Each sport's already-tuned K / home-field advantage live on its own ingest
# module (e.g. src.sports.cfb.ingest.ELO_K) rather than here, so a caller
# that needs ready-to-use Elo predictions for a given sport doesn't have to
# re-run tune()'s grid search every time.


def expected_home_win_prob(home_rating: float, away_rating: float, home_advantage: float) -> float:
    return 1.0 / (1.0 + 10 ** (-(home_rating + home_advantage - away_rating) / 400))


def simulate(games: pd.DataFrame, k: float, home_advantage: float) -> pd.DataFrame:
    """Walk every game chronologically, predicting with the current rating
    (pre-update) then updating both teams' ratings after the result."""
    ratings: dict[str, float] = {}
    current_season = None
    predictions = []

    for row in games.itertuples():
        if row.season != current_season:
            if current_season is not None:
                ratings = {
                    team: INITIAL_RATING + SEASON_CARRYOVER * (rating - INITIAL_RATING)
                    for team, rating in ratings.items()
                }
            current_season = row.season

        home_rating = ratings.get(row.home_team, INITIAL_RATING)
        away_rating = ratings.get(row.away_team, INITIAL_RATING)
        hfa = 0.0 if row.neutral_site else home_advantage
        home_prob = expected_home_win_prob(home_rating, away_rating, hfa)

        predictions.append(
            {
                "game_id": row.game_id,
                "season": row.season,
                "week": row.week,
                "home_team": row.home_team,
                "away_team": row.away_team,
                "home_pregame_elo": home_rating,
                "away_pregame_elo": away_rating,
                "home_win_prob": home_prob,
                "home_win": row.home_win,
            }
        )

        ratings[row.home_team] = home_rating + k * (row.home_win - home_prob)
        ratings[row.away_team] = away_rating + k * ((1 - row.home_win) - (1 - home_prob))

    return pd.DataFrame(predictions)


def score(predictions: pd.DataFrame) -> dict:
    y_true = predictions["home_win"]
    y_prob = predictions["home_win_prob"].clip(1e-6, 1 - 1e-6)
    accuracy = ((y_prob > 0.5).astype(int) == y_true).mean()
    return {
        "n": len(predictions),
        "log_loss": log_loss(y_true, y_prob),
        "brier": brier_score_loss(y_true, y_prob),
        "accuracy": accuracy,
    }


def tune(games: pd.DataFrame, tune_end_season: int) -> tuple[float, float]:
    """Grid search K and home-field advantage, scored by log loss on games
    through tune_end_season (inclusive). Ratings still carry over from the
    full history available, so early tuning-window games get a fair warm-up."""
    k_grid = [10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150]
    hfa_grid = [0, 25, 50, 65, 75, 100, 125]

    best_params, best_loss = None, float("inf")
    for k, hfa in itertools.product(k_grid, hfa_grid):
        predictions = simulate(games, k, hfa)
        tuning_slice = predictions[predictions["season"] <= tune_end_season]
        result = score(tuning_slice)
        if result["log_loss"] < best_loss:
            best_loss = result["log_loss"]
            best_params = (k, hfa)
    return best_params


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sport", default="cfb", choices=registry.SPORTS)
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    parser.add_argument("--test-season", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    games = registry.ingest_module(args.sport).load_games(args.start, args.end)
    tune_end = args.test_season - 1

    best_k, best_hfa = tune(games, tune_end)
    print(f"Best params: K={best_k}, home_advantage={best_hfa} (tuned on {args.start}-{tune_end})")

    predictions = simulate(games, best_k, best_hfa)

    tune_metrics = score(predictions[predictions["season"] <= tune_end])
    test_metrics = score(predictions[predictions["season"] == args.test_season])
    naive_home_accuracy = predictions.loc[
        predictions["season"] == args.test_season, "home_win"
    ].mean()

    print(f"\nTuning window ({args.start}-{tune_end}): {tune_metrics}")
    print(f"Held-out season {args.test_season}:      {test_metrics}")
    print(f"Naive 'home always wins' accuracy on {args.test_season}: {naive_home_accuracy:.4f}")


if __name__ == "__main__":
    main()
