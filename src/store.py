"""SQLite prediction store: schema and connection helper shared by
predict.py, reconcile.py, and api/main.py.

market_snapshots is the same idea for Kalshi prices: one row per game per
refresh run, captured only before the game starts. There's no free archive
of historical NBA odds, so this builds one going forward -- once a season or
so has accumulated, it can be trained on (see src/market_history.py).

early_predictions is the opposite of predictions: a scratch table of
not-yet-frozen predictions for games just beyond a sport's freeze horizon
(NBA games 12-36 hours out), fully replaced on every refresh run. They feed
the Parlay Picker's pool and fill the predictions page until a game freezes,
always flagged as early lines -- never graded, never counted in accuracy.

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
    game_id TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS market_snapshots (
    sport TEXT NOT NULL,
    game_id TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    game_date TEXT NOT NULL,
    source TEXT NOT NULL,
    home_probability REAL NOT NULL,
    away_probability REAL NOT NULL,
    volume REAL,
    event_ticker TEXT,
    PRIMARY KEY (sport, game_id, captured_at)
);
CREATE TABLE IF NOT EXISTS early_predictions (
    sport TEXT NOT NULL,
    game_id TEXT NOT NULL,
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
    PRIMARY KEY (sport, game_id)
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(config.PREDICTIONS_DB)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn
