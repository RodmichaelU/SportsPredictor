# College Football Predictor: Build Plan

A phased implementation plan for a CFB game predictor. Built for driving in Claude Code: each phase ends in a runnable check so you can verify before moving on.

## Scope (v1)

- Sport: American college football only (FBS to start).
- Predict two targets per game: **win probability** (classification) and **point margin** (regression).
- Historical training, held-out season for testing, then weekly predictions for upcoming games.
- Out of scope for v1: live in-game score updates. A web frontend (sport selector, predicted vs actual, confidence per pick) and multi-sport support are planned later phases, see below.

## Success criteria

- Beat a naive baseline (pick higher-rated team) on a held-out season.
- Beat or match a from-scratch Elo model.
- Stay calibrated against the closing Vegas line (log loss and Brier, not just accuracy).
- If the ML model can't beat Elo, that's a documented finding, not a failure to hide.

## Tech stack

- Language: Python 3.11+
- Data: `cfbd` (or raw `requests`), `pandas`, `pyarrow` (parquet caching)
- Models: `scikit-learn` (Elo helpers, logistic, ridge), `xgboost` or `lightgbm`
- Eval: `scikit-learn` metrics, `matplotlib` for calibration curves
- Backend/serving: `fastapi`, `uvicorn`
- Prediction store: SQLite (via `sqlite3` or SQLAlchemy) to start, Postgres if it grows
- Frontend: React or Next.js
- Config/secrets: `python-dotenv`, `.env` for the CFBD key

## Data source

- CollegeFootballData (CFBD), base URL `https://api.collegefootballdata.com`.
- Free key: 1,000 calls/month. Academic tier (student email): 3,000/month. Get the higher one if your UCalgary address qualifies.
- Key lives in `.env` as `CFBD_API_KEY`, never committed.

## Hard constraints (bake these in from day one)

1. **No data leakage.** Features for a game may only use information available before kickoff. Use season-to-date or rolling stats, never full-season aggregates that include the target game.
2. **API budget.** 1k calls/month goes fast. Cache every raw API response to disk and read from cache on reruns. Never re-pull data you already have.
3. **Temporal splits only.** Train on past seasons, test on a later held-out season. No random shuffling of games across time.
4. **Secrets stay out of git.** `.env` in `.gitignore` from the first commit.

## Repo structure

```
cfb-predictor/
  .env                 # CFBD_API_KEY (gitignored)
  .gitignore
  CLAUDE.md            # constraints for Claude Code (see below)
  requirements.txt
  config.py            # seasons, paths, constants
  data/
    raw/               # cached API responses
    processed/         # feature tables
    predictions.db     # persisted pre-game predictions + results (SQLite)
  src/
    cfbd_client.py     # auth, rate-limit handling, caching wrapper
    ingest.py          # pull games, team stats, lines -> data/raw
    features.py        # build one-row-per-game feature table
    elo.py             # from-scratch Elo baseline
    models.py          # logistic + gradient boosting
    evaluate.py        # metrics, calibration, vs-Vegas comparison
    predict.py         # generate + persist predictions for upcoming games
    reconcile.py       # match stored predictions against final scores
  api/
    main.py            # FastAPI: /sports, /predictions, /results, /accuracy
  frontend/            # React/Next.js client (added in Phase 7)
  notebooks/           # exploration
  tests/
    test_leakage.py    # asserts no future info in features
```

## CLAUDE.md (put this in the repo)

Give Claude Code the rules up front so it respects them across the whole build:
- Never use full-season stats as pre-game features; only season-to-date or rolling.
- Always read from `data/raw` cache before hitting the API.
- Temporal train/test splits only, never shuffle across seasons.
- Never commit `.env` or the API key.
- Every phase must end with a runnable command that produces verifiable output.

## Models and evaluation (spec)

### Targets
- Win probability: binary classification (does the home team win).
- Point margin: regression (home score minus away score).
- Total points: regression, optional, same approach as margin.

### Classifiers and regressors, in build order
1. **Naive baselines (the floor):** pick the home team, and pick the higher-rated team (by SP+ or Elo). If a model can't beat these, it's broken.
2. **Elo (baseline model):** rating difference to win probability via the logistic formula. Your reference point for whether ML is worth the added complexity.
3. **Logistic Regression** (`sklearn.LogisticRegression`, L2 regularized): first real classifier on engineered features.
4. **Gradient Boosting** (`XGBClassifier` or `LGBMClassifier`): the main classifier. Same library for the regressor (`XGBRegressor` / `LGBMRegressor`) on margin.
5. **Optional sanity check:** Random Forest, only to confirm gradient boosting is actually better. Skip if short on time.

Skip neural nets for v1. Tabular data with limited games per season gives them no edge over gradient boosting.

### Metrics
Classification (win probability), in priority order:
- **Log loss (primary):** punishes confident wrong predictions, the correct objective for probabilities.
- **Brier score (primary):** combined accuracy and calibration.
- **Calibration curve + Expected Calibration Error:** is a predicted 70% actually right about 70% of the time.
- **AUC-ROC:** ranking / discrimination ability.
- **Accuracy:** report it, but treat it as secondary. It hides overconfidence.

Regression (margin/total):
- **MAE in points (primary):** interpretable.
- **RMSE.**

### What we measure against (accuracy benchmarks)
Three benchmarks, weakest to strongest:
1. **Naive baseline (home/favorite).** Straight-up this lands around the low 60s percent in CFB. Beat it comfortably or something is wrong.
2. **Your Elo model.** The ML model has to beat Elo on log loss and Brier to justify itself.
3. **The market (the real test).** Take the closing spread or moneyline, convert to an implied win probability (de-vig the moneyline), and compare your log loss and Brier to the market's on the same games. Beating the closing line is hard; matching it is a strong result.

For a betting-style read on margin predictions, use against-the-spread (ATS) record. Break-even at standard -110 juice is **52.4 percent**. Beating 52.4 percent ATS on a held-out season is the bar, and it's a high one. Expect straight-up win accuracy in the low-to-mid 70s for a good model, but judge success on log loss and Brier versus the market, not raw accuracy.

### Validation method
- Temporal, walk-forward. Train on seasons up to year N, test on year N+1.
- Prefer multiple held-out seasons (expanding window) over a single split, so the result isn't one lucky or unlucky year.
- Never shuffle games across time. That leaks the future into training.

## Phased build

### Phase 0: Setup
- Init repo, venv, `requirements.txt`, `.gitignore`, `.env`, `config.py`, `CLAUDE.md`.
- **Check:** a smoke script hits CFBD `/games` for one team/season and prints a game.

### Phase 1: Data layer
- Build `cfbd_client.py`: Bearer auth, retry/backoff, and disk caching of raw responses.
- `ingest.py`: pull games, team season stats, and betting lines for a range of seasons (default 2015 to latest complete season).
- **Check:** `data/raw` holds cached games + lines; rerunning makes zero new API calls.

### Phase 2: Feature engineering
- `features.py`: one row per game, pre-game features only.
- Feature set: EPA/play (off and def, season-to-date), success rate, points per drive, SP+ / Elo ratings, talent composite, rest days, home/away/neutral, conference game, and the closing line.
- Write `test_leakage.py` that fails if any feature uses post-kickoff data.
- **Check:** `data/processed/features.parquet` exists and the leakage test passes.

### Phase 3: Elo baseline
- `elo.py`: implement Elo from scratch, tune K and home-field advantage on historical seasons.
- Output win probability per game.
- **Check:** Elo predictions with baseline log loss, Brier, and accuracy printed.

### Phase 4: ML models
- `models.py`: logistic regression + gradient boosting for win prob; ridge or gradient boosting for margin.
- Temporal split: train on earlier seasons, test on the most recent complete season.
- **Check:** model metrics printed side by side with Elo on the held-out season.

### Phase 5: Evaluation and calibration
- `evaluate.py`: log loss, Brier, a calibration curve, and comparison against the closing spread converted to an implied win probability.
- **Check:** an eval report showing where the model beats, matches, or loses to the market.

### Phase 6: Prediction store, results reconciliation, and serving API
This is the backend the frontend depends on, so it's no longer optional.
- `predict.py`: for a given sport and week, pull upcoming games and generate predictions (win probability, predicted winner, margin).
- **Persist every prediction before kickoff** into a store (SQLite to start): sport, game_id, season, week, teams, game_date, predicted_at, win probability (the confidence), predicted winner, predicted margin, model_version. Freezing the prediction is what makes predicted-vs-actual honest later. Never regenerate a past prediction.
- `reconcile.py`: after games finish, pull final scores, mark each stored prediction hit or miss, and record the actual margin.
- FastAPI endpoints:
  - `GET /sports` returns sports available for prediction
  - `GET /predictions?sport=&week=` returns upcoming games with confidence
  - `GET /results?sport=&week=` returns completed games: prediction vs actual, hit or miss
  - `GET /accuracy?sport=` returns rolling accuracy and calibration summary
- **Check:** generate predictions for the current week, backfill a past week or wait one out, run reconcile, and hit `/results` to see predicted vs actual with a running accuracy.

## Frontend (planned)

A thin client over the Phase 6 API. Ship it CFB-only first, but build every call sport-parameterized so added sports populate the selector automatically.

**The three user-facing features map directly to the API:**
- **Sport selector:** driven by `GET /sports`. One option (CFB) at first, more as you add them.
- **Predicted vs actual:** driven by `GET /results`. Each completed game shows the prediction, the actual result, and a hit/miss indicator, plus a running accuracy per sport.
- **Confidence per prediction:** the win probability from `GET /predictions`, shown as a percentage. Because the model is calibrated (Phase 5), a shown 70% should hit near 70%. Optionally surface the calibration record so the number is trustworthy, not just displayed.

**Honest-design rule (the frontend version of the leakage rule):** the confidence and pick shown for a game must be the values frozen at prediction time and read from the store, never recomputed after the result is known. Otherwise the predicted-vs-actual view is a lie.

**Stack:** React or Next.js (your existing stack) over the FastAPI backend. Tables plus a simple accuracy chart are enough for v1, no heavy UI.

### Phase 7: Frontend
- Build the three views (sport selector, upcoming predictions with confidence, results with predicted vs actual and running accuracy) against the Phase 6 API.
- CFB-only data, but every request carries a `sport` param so nothing hard-codes CFB.
- **Check:** select CFB, see this week's predictions with confidence percentages, and see last week's predictions scored against actual results.

## Multi-sport expansion (planned)

Build v1 CFB-only, but leave two seams so adding sports later is cheap rather than a rewrite. Do not build the full abstraction up front; just avoid hard-coding CFB into the model and eval code.

**What carries over unchanged (the entire model core):**
- Elo baseline, logistic regression, gradient boosting
- Temporal splits, log loss / Brier / calibration, benchmarking vs the closing line
- The prediction targets: win probability, margin, total

**What is sport-specific (isolate these):**
- The data source / API
- Feature engineering (each sport has its own signals: pace in the NBA, special teams in football, goalie and shot quality in the NHL)
- Season length and home-advantage magnitude

**The one v1 design change that pays off:** normalize every data source into a common game schema (date, season, home, away, home_score, away_score, plus a features dict). Keep `models.py` and `evaluate.py` operating only on that schema, never on CFBD-specific fields. Then a new sport is just a new data adapter plus a feature module, not a change to the model or eval code.

**Per-sport data sources (all free):**
- NFL: `nflreadpy` (nflverse). Note: the older `nfl_data_py` is now deprecated in favour of nflreadpy, so start with nflreadpy. Play-by-play back to 1999, plus scoring lines and win totals.
- NBA: `nba_api` (Python wrapper for stats.nba.com). No key required.
- NHL: official NHL web API at `api-web.nhle.com/v1` plus `api.nhle.com/stats/rest`. No key required. The old `statsapi.web.nhl.com` is decommissioned, do not use it.
- Optional unified route: `sportsdataverse` pulls NFL, NBA, NHL, and CFB from ESPN through one library if you'd rather not wire up four sources separately. Tradeoff: less sport-specific depth than the dedicated sources.

### Phase 8: add a second sport
- Refactor `cfbd_client.py` and `ingest.py` into a per-sport adapter (e.g. `src/sports/cfb/`, `src/sports/nfl/`) that emits the common game schema.
- Pick NFL as sport #2: cleanest data via nflreadpy, and same sport structure as CFB so features transfer most directly.
- Reuse the entire model and eval pipeline as-is.
- **Check:** the same `evaluate.py` runs on NFL data and produces the same metric report with no model code changes.

## Real-time and game-day signals (deferred to the multi-sport phase)

**Decision:** hold this until NFL, NBA, and NHL are in. Those leagues have mandated, structured injury reporting (NFL and NBA especially), so the real-time injury layer pays off far more there than in patchy CFB data. For CFB v1, the closing line already encodes injury news indirectly, so deferring costs little accuracy. The tiers below still apply whenever you build it.

**Governing rule:** a feature is usable only if you have it both at prediction time AND historically for every training game. Many real-time signals fail the historical half, so you can't train on them even when you can fetch them live.

**Two hard realities for CFB injuries:**
1. No league-wide mandate. The NCAA leaves it to conferences. Big Ten (availability reports since 2023, four per week for 2026 conference games) and SEC (since 2024) publish reports, but for conference games only and mostly Power leagues. Historical injury data is recent, partial, and inconsistent.
2. The market already knows. The closing line prices in known injuries within minutes. If you use the closing line as a feature or benchmark, injuries are largely baked in. Injury data adds edge only if you get it before the market moves or judge impact better than it does.

**Tiered plan, most tractable first:**

Tier 1 (build this, full historical coverage):
- **Line movement:** opening line to closing line. CFBD lines include opening and closing fields, so you get both historically. The movement itself encodes injury news, weather, and sharp action, making it the best real-time proxy you can actually train on.
- **Weather:** game-day wind, precipitation, temperature. Wind matters for passing and kicking. Open-Meteo has free historical and forecast endpoints (no key), so it passes both the training and prediction tests.

Tier 2 (high value, partial data, apply as an adjustment not a trained feature):
- **Starting QB status.** The single biggest swing in CFB. You likely can't train on it historically in clean form, so apply it as a rule-based adjustment on top of the model output for upcoming games (downgrade a team when its starter is out), rather than as a model feature.

Tier 3 (aspirational experiment):
- **Full availability-report ingestion** from Big Ten and SEC sites. Recent seasons, conference games, Power leagues only. Scrape the conference sites (no clean API), expect sparse coverage and heavy missing-data handling. Only worth it once Tiers 1 and 2 are solid.

**Pipeline change this forces:** real-time features mean fetching a game-day snapshot close to kickoff, and snapshotting every feature "as of" your prediction moment. If you predict Thursday, use Thursday's line and report, never Saturday's closing values, or you leak the future.

**Decide your goal first:**
- Accurate predictions: use the closing line, weather, and any injury info you have. This will be strong.
- Edge over the market: you cannot lean on the closing line (it already knows), and injuries help only if you're faster or sharper than it. A much higher bar.

### Phase 9: real-time signal layer (after multi-sport expansion)
- Add Tier 1 (line movement, weather) as trained features first, since they have full history.
- Add Tier 2 (QB status) as a post-model adjustment for upcoming-game predictions.
- **Check:** the same eval pipeline shows whether line movement and weather improve log loss and Brier on a held-out season versus the v1 model.

## Key decisions to lock before you start

- Seasons to train on: default 2015 to latest complete. Adjust for data availability.
- Primary target: win probability first, margin second. Confirm which you care about most.
- Scope of teams: FBS only for v1 to keep data clean.

## Suggested first message to Claude Code

"Read PLAN.md and CLAUDE.md. Start Phase 0 only: set up the repo structure, dependencies, config, and a smoke test that pulls one game from the CFBD API. Stop after the smoke test passes so I can verify before Phase 1."
