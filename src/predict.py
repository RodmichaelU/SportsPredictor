"""Generate and freeze predictions for a sport/season/week's upcoming games.

Trains on every complete historical season (Phase 4/5 found logistic
regression for win probability and ridge for margin the strongest of the
models tried), predicts the requested week, and writes each prediction to
the store via INSERT OR IGNORE -- a prediction already on record for a game
is never regenerated, so what's shown later as "predicted" is always what
was actually known before kickoff.

Run: python -m src.predict --season 2026 --week 2
"""

import argparse
from datetime import datetime, timezone

import config
from src import features, models, store

SPORT = "cfb"
MODEL_VERSION = "v1-logistic-ridge"


def generate_predictions(season: int, week: int, backfill: bool = False) -> list[dict]:
    """backfill=True predicts a week that's already been played, using the
    same pre-game-only features (still no peeking at the result) -- for
    validating reconcile.py end-to-end without waiting for a live week to
    finish. Real usage should leave this False."""
    history = models.load_feature_table()
    X_train = history[models.FEATURE_COLUMNS]
    y_train_win = history["home_win"]
    y_train_margin = history["margin"]

    logistic = models.fit_logistic(X_train, y_train_win)
    ridge = models.fit_ridge(X_train, y_train_margin)

    if backfill:
        season_features = features.build_season_features(season)
        upcoming = season_features[season_features["week"] == week] if not season_features.empty else season_features
    else:
        upcoming = features.build_upcoming_features(season, week)
    if upcoming.empty:
        return []

    upcoming = upcoming.copy()
    for base in models.DIFF_BASES:
        upcoming[f"{base}_diff"] = upcoming[f"home_{base}"] - upcoming[f"away_{base}"]
    upcoming["elo_diff"] = upcoming["home_pregame_elo"] - upcoming["away_pregame_elo"]
    upcoming["neutral_site"] = upcoming["neutral_site"].astype(int)
    upcoming["conference_game"] = upcoming["conference_game"].astype(int)

    X = upcoming[models.FEATURE_COLUMNS]
    home_win_prob = logistic.predict_proba(X)[:, 1]
    predicted_margin = ridge.predict(X)

    predicted_at = datetime.now(timezone.utc).isoformat()
    rows = []
    for i, (_, game) in enumerate(upcoming.iterrows()):
        winner = game["home_team"] if home_win_prob[i] >= 0.5 else game["away_team"]
        rows.append(
            {
                "sport": SPORT,
                "game_id": int(game["game_id"]),
                "season": int(game["season"]),
                "week": int(game["week"]),
                "home_team": game["home_team"],
                "away_team": game["away_team"],
                "game_date": game["start_date"],
                "predicted_at": predicted_at,
                "home_win_prob": float(home_win_prob[i]),
                "predicted_winner": winner,
                "predicted_margin": float(predicted_margin[i]),
                "model_version": MODEL_VERSION,
            }
        )
    return rows


def save_predictions(rows: list[dict]) -> int:
    if not rows:
        return 0
    conn = store.get_connection()
    with conn:
        cursor = conn.executemany(
            """
            INSERT OR IGNORE INTO predictions
                (sport, game_id, season, week, home_team, away_team, game_date,
                 predicted_at, home_win_prob, predicted_winner, predicted_margin, model_version)
            VALUES
                (:sport, :game_id, :season, :week, :home_team, :away_team, :game_date,
                 :predicted_at, :home_win_prob, :predicted_winner, :predicted_margin, :model_version)
            """,
            rows,
        )
        inserted = cursor.rowcount
    conn.close()
    return inserted


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--week", type=int, required=True)
    parser.add_argument(
        "--backfill", action="store_true",
        help="Predict an already-played week (still pre-game features only) to validate reconcile.py without waiting for a live week to finish.",
    )
    args = parser.parse_args()

    rows = generate_predictions(args.season, args.week, backfill=args.backfill)
    inserted = save_predictions(rows)
    skipped = len(rows) - inserted
    print(f"{args.season} week {args.week}: {len(rows)} upcoming games, {inserted} predictions saved, {skipped} already on record")
    for row in rows:
        print(f"  {row['away_team']} @ {row['home_team']}: {row['predicted_winner']} "
              f"({row['home_win_prob']:.1%} home win prob, margin {row['predicted_margin']:+.1f})")


if __name__ == "__main__":
    main()
