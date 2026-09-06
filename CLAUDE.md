# Constraints for this repo

This is a phased ML build (see PLAN.md). These rules apply across every phase:

1. **No data leakage.** Features for a game may only use information available before kickoff. Use season-to-date or rolling stats, never full-season aggregates that include the target game.
2. **API budget.** The CFBD free key is 1,000 calls/month. Cache every raw API response to disk under `data/raw/` and read from cache on reruns. Never re-pull data already cached.
3. **Temporal splits only.** Train on past seasons, test on a later held-out season. Never shuffle games across time.
4. **Secrets stay out of git.** `.env` holds `CFBD_API_KEY` and is gitignored. Never commit it or print its value.
5. **Every phase ends with a runnable check** that produces verifiable output (a script, a printed report, a test) before moving to the next phase.
6. **Free resources only.** Every data source and service used must be free (CFBD free tier, nflreadpy, nba_api, NHL web API, Open-Meteo, SQLite). Flag it before adding anything paid.
7. **Sport-agnostic core.** Keep `models.py` and `evaluate.py` operating on the common game schema (date, season, home, away, home_score, away_score, features dict), never on CFBD-specific field names, so later sports are new adapters, not rewrites.
