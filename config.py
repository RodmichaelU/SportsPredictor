"""Central config: paths, seasons, and constants shared across the pipeline."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

CFBD_API_KEY = os.environ.get("CFBD_API_KEY", "")
CFBD_BASE_URL = "https://api.collegefootballdata.com"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
PREDICTIONS_DB = DATA_DIR / "predictions.db"

RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Default season range for historical ingestion. Adjust as data availability changes.
START_SEASON = 2015
CURRENT_SEASON = 2025

# FBS only for v1.
DIVISION = "fbs"
