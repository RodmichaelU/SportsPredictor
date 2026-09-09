# SportsPredictor

ML-driven win probability and point margin predictions for American college football and NFL. See [PLAN.md](PLAN.md) for the full phased build plan and [CLAUDE.md](CLAUDE.md) for the constraints every phase follows.

Each sport is a self-contained adapter under `src/sports/<id>/` (`ingest.py` + `features.py`); `elo.py`, `models.py`, and `evaluate.py` are sport-agnostic and dispatch by a `--sport` flag through `src/sports/registry.py`. Adding a sport means writing a new adapter, not touching the model code.

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
```

## Frontend

See [frontend/README.md](frontend/README.md). Requires Node 20.9+ (`brew install node@20`, since it's newer than most system defaults).
