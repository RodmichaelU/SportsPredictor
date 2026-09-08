# SportsPredictor

ML-driven win probability and point margin predictions, starting with American college football. See [PLAN.md](PLAN.md) for the full phased build plan and [CLAUDE.md](CLAUDE.md) for the constraints every phase follows.

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

Each script reads from `data/raw/` cache when possible and writes to `data/processed/` or prints a report:

```bash
python3 -m src.ingest --start 2015 --end 2025    # pull games, stats, lines, ratings (cached)
python3 -m src.features --start 2015 --end 2025  # build data/processed/features.parquet
python3 -m pytest tests/                          # leakage tests
python3 -m src.elo                                # from-scratch Elo baseline
python3 -m src.models                              # logistic regression + XGBoost vs. Elo
python3 -m src.evaluate                            # calibration + comparison vs. the closing line

python3 -m src.predict --season 2026 --week 2      # freeze predictions for a week (never regenerated)
python3 -m src.reconcile                            # score frozen predictions against final results
uvicorn api.main:app --port 8000                    # serve /sports /predictions /results /accuracy
```

## Frontend

See [frontend/README.md](frontend/README.md). Requires Node 20.9+ (`brew install node@20`, since it's newer than most system defaults).
