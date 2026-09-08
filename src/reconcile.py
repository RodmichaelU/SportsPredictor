"""Match stored predictions against final scores once games finish.

Only fills in the result columns (home_score, away_score, actual_winner,
actual_margin, hit) for rows where hit IS NULL -- the prediction fields
themselves (frozen by predict.py) are never touched.

Run: python -m src.reconcile [--sport cfb]
"""

import argparse
from datetime import datetime, timezone

from src import ingest, store

SPORT = "cfb"


def reconcile(sport: str = SPORT) -> int:
    conn = store.get_connection()
    pending = conn.execute(
        "SELECT DISTINCT season FROM predictions WHERE sport = ? AND hit IS NULL", (sport,)
    ).fetchall()

    updated = 0
    now = datetime.now(timezone.utc).isoformat()
    for row in pending:
        season = row["season"]
        games_by_id = {g["id"]: g for g in ingest.ingest_games(season)}

        rows = conn.execute(
            "SELECT game_id FROM predictions WHERE sport = ? AND season = ? AND hit IS NULL",
            (sport, season),
        ).fetchall()

        for r in rows:
            game = games_by_id.get(r["game_id"])
            if not game or not game["completed"]:
                continue
            home_score, away_score = game["homePoints"], game["awayPoints"]
            actual_winner = game["homeTeam"] if home_score > away_score else game["awayTeam"]
            actual_margin = home_score - away_score

            pred = conn.execute(
                "SELECT predicted_winner FROM predictions WHERE sport = ? AND game_id = ?",
                (sport, r["game_id"]),
            ).fetchone()
            hit = int(pred["predicted_winner"] == actual_winner)

            with conn:
                conn.execute(
                    """
                    UPDATE predictions
                    SET home_score = ?, away_score = ?, actual_winner = ?,
                        actual_margin = ?, hit = ?, reconciled_at = ?
                    WHERE sport = ? AND game_id = ?
                    """,
                    (home_score, away_score, actual_winner, actual_margin, hit, now, sport, r["game_id"]),
                )
            updated += 1

    conn.close()
    return updated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sport", default=SPORT)
    args = parser.parse_args()

    updated = reconcile(args.sport)
    print(f"Reconciled {updated} predictions for sport={args.sport}")


if __name__ == "__main__":
    main()
