# SportsPredictor

ML-driven win probability and point margin predictions for American college football and NFL. See [PLAN.md](PLAN.md) for the full phased build plan and [CLAUDE.md](CLAUDE.md) for the constraints every phase follows.

Each sport is a self-contained adapter under `src/sports/<id>/` (`ingest.py` + `features.py`); `elo.py`, `models.py`, and `evaluate.py` are sport-agnostic and dispatch by a `--sport` flag through `src/sports/registry.py`. Adding a sport means writing a new adapter, not touching the model code.

**Status per sport:**

| Sport | `ingest.py` (`load_games`) | `features.py` | Live in the app |
| --- | --- | --- | --- |
| CFB (`cfb`) | ✅ | ✅ | ✅ |
| NFL (`nfl`) | ✅ | ✅ | ✅ |
| NBA (`nba`) | ✅ real, tested | ❌ documented stub | not yet (`api/main.py`'s `SPORTS` list doesn't include it) |
| NHL (`nhl`) | ✅ real, tested | ❌ documented stub | not yet |

NBA and NHL are **architecture-ready, not fully built**: `load_games()` is real (data source confirmed live -- `nba_api` for NBA, `api-web.nhle.com` for NHL, both free and keyless), so `python -m src.elo --sport nba` / `--sport nhl` already run end to end with real tuned constants. `features.py` for each is a documented stub that raises `NotImplementedError` with a checklist pointing at exactly what's needed -- read that file's module docstring before starting the next piece. `models.py`/`evaluate.py`/`predict.py`/`reconcile.py` will fail loudly (not silently) on `--sport nba`/`--sport nhl` until that's built; that's the intended signal, not a bug to fix around.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `CFBD_API_KEY` (free key: https://collegefootballdata.com/key).

**macOS only:** XGBoost needs the OpenMP runtime, which isn't bundled:
```bash
brew install libomp
```

## Pipeline

Each script reads from `data/raw/` cache when possible and writes to `data/processed/` or prints a report. Every command below takes `--sport cfb` (default) or `--sport nfl`:

```bash
python3 -m src.sports.cfb.ingest --start 2015 --end 2025      # cfb only: pull games, stats, lines, ratings (cached)
python3 -m src.sports.cfb.features --start 2015 --end 2025    # cfb only: build data/processed/cfb_features.parquet
python3 -m src.sports.nfl.features --start 2015 --end 2025    # nfl: build data/processed/nfl_features.parquet (nflreadpy, no ingest step needed)
python3 -m pytest tests/                                       # leakage tests (both sports)
python3 -m src.elo --sport nfl                                 # from-scratch Elo baseline
python3 -m src.models --sport nfl                               # logistic regression + XGBoost vs. Elo
python3 -m src.evaluate --sport nfl                             # calibration + comparison vs. the closing line

python3 -m src.predict --sport nfl --season 2026 --week 2      # freeze predictions for a week (never regenerated)
python3 -m src.reconcile --sport nfl                            # score frozen predictions against final results
uvicorn api.main:app --port 8000                                # serve /sports /predictions /results /accuracy (all sports)

python3 -m src.sports.nba.ingest --start 2024 --end 2024        # nba: confirm load_games() works (no features.py yet)
python3 -m src.elo --sport nba                                  # nba: real Elo baseline, tuned constants in ingest.py
python3 -m src.sports.nhl.ingest --start 2024 --end 2024        # nhl: same, via api-web.nhle.com
python3 -m src.elo --sport nhl
```

## Live market odds

`src/odds/kalshi.py` pulls live prices from [Kalshi](https://kalshi.com), a CFTC-regulated real-money prediction market with a free, public, no-API-key REST API and individual game markets for both leagues. Matched to our games by team name/abbreviation (crosswalk + alias table in that file, verified against live data while building it). Shown as the "Market" column on `/predictions` and a live comparison bar on each game's `/games/[id]` page -- gracefully absent (never an error) when a game has no open Kalshi market, e.g. once it's finished and the market has settled.

bet365 and similar bookmakers have no public API and weren't scraped; Polymarket's sports coverage is mostly futures markets (Super Bowl winner, etc.), not individual weekly games, so it wasn't used either.

## Frontend

See [frontend/README.md](frontend/README.md). Requires Node 20.9+ (`brew install node@20`, since it's newer than most system defaults).
