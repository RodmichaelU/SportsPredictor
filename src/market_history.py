"""Save live Kalshi prices for every not-yet-started predicted game, building
a pre-game market history we can't get for free any other way (there's no
free historical NBA odds source, which is why the NBA model has no market
feature today).

Called on every refresh.py run, so each game collects several snapshots
before tip-off -- the last one before game time is the closest thing to a
closing line, and the sequence shows how the price moved.

Only games whose start time is still in the future are captured, so an
in-game price (which already knows the score) can never end up in this
table and leak into a model trained on it later.

Run: python -m src.market_history --sport nba
"""

import argparse
from datetime import datetime, timezone

from src import store
from src.odds import kalshi
from src.sports import registry

SOURCE = "kalshi"


def snapshot(sport: str) -> int:
    """Insert one row per upcoming predicted game with an open market.
    Returns how many were saved."""
    now = datetime.now(timezone.utc)
    conn = store.get_connection()
    upcoming = [
        r for r in conn.execute(
            "SELECT game_id, home_team, away_team, game_date FROM predictions WHERE sport = ? AND hit IS NULL",
            (sport,),
        ).fetchall()
        if datetime.fromisoformat(r["game_date"]) > now
    ]
    if not upcoming:
        conn.close()
        return 0

    index = kalshi.build_index(sport)
    captured_at = now.isoformat()
    rows = []
    for r in upcoming:
        market = kalshi.match_game(sport, r["home_team"], r["away_team"], index)
        if market:
            rows.append(
                {
                    "sport": sport, "game_id": r["game_id"], "captured_at": captured_at,
                    "game_date": r["game_date"], "source": SOURCE,
                    "home_probability": market["home_probability"],
                    "away_probability": market["away_probability"],
                    "volume": market["volume"], "event_ticker": market["event_ticker"],
                }
            )
    with conn:
        conn.executemany(
            """
            INSERT OR IGNORE INTO market_snapshots
                (sport, game_id, captured_at, game_date, source, home_probability,
                 away_probability, volume, event_ticker)
            VALUES
                (:sport, :game_id, :captured_at, :game_date, :source, :home_probability,
                 :away_probability, :volume, :event_ticker)
            """,
            rows,
        )
    conn.close()
    return len(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sport", default="nba", choices=registry.SPORTS)
    args = parser.parse_args()
    print(f"Saved {snapshot(args.sport)} {args.sport} market snapshots")


if __name__ == "__main__":
    main()
