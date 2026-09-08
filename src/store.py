"""SQLite prediction store: schema and connection helper shared by
predict.py, reconcile.py, and api/main.py.

Predictions are append-only once written -- predict.py uses INSERT OR IGNORE
keyed on (sport, game_id), so a prediction already on record is never
overwritten even if the same week is predicted again. That's what makes the
predicted-vs-actual view honest: what's shown was frozen before kickoff.
"""

import sqlite3

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    sport TEXT NOT NULL,
    game_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_date TEXT NOT NULL,
    predicted_at TEXT NOT NULL,
    home_win_prob REAL NOT NULL,
    predicted_winner TEXT NOT NULL,
    predicted_margin REAL NOT NULL,
    model_version TEXT NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    actual_winner TEXT,
    actual_margin REAL,
    hit INTEGER,
    reconciled_at TEXT,
    PRIMARY KEY (sport, game_id)
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(config.PREDICTIONS_DB)
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    return conn
