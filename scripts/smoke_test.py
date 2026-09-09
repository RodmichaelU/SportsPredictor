"""Phase 0 check: hit CFBD /games for one team/season and print a game.

Run: python scripts/smoke_test.py
Requires CFBD_API_KEY in .env.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.sports.cfb import client


def main():
    games = client.get(
        "/games",
        {"year": 2023, "seasonType": "regular", "team": "Georgia"},
    )
    if not games:
        print("No games returned. Check CFBD_API_KEY and try again.")
        sys.exit(1)

    game = games[0]
    print("CFBD smoke test OK. Sample game:")
    print(
        f"  {game.get('season')} week {game.get('week')}: "
        f"{game.get('awayTeam')} @ {game.get('homeTeam')} "
        f"({game.get('awayPoints')}-{game.get('homePoints')})"
    )


if __name__ == "__main__":
    main()
