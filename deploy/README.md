# Deploying SportsPredictor (GitHub Pages)

The site runs entirely on GitHub: no server, no credit card. A GitHub Actions workflow ([.github/workflows/refresh.yml](../.github/workflows/refresh.yml)) does what the Mac's launchd agent did, then publishes the result:

1. **Every 3 hours** (`:05` past every third hour, UTC) it restores the prediction database and API cache, runs `python -m src.refresh --all` (freeze picks, grade results, save market prices, NBA early lines), and saves the database back.
2. It exports everything the site shows to JSON (`python -m src.export_static`) and builds the site as static pages.
3. It publishes them to **https://rodmichaelu.github.io/SportsPredictor/**.

Every page shows when the data was last updated ("Odds & results updated 3:05 PM · 42 min ago"), since odds are as of the last refresh rather than live.

**Where the data lives between runs**

| What | Where | If it's lost |
|---|---|---|
| `predictions.db` (every frozen pick and graded result) | the repo's `data` branch, replaced each run; plus a 14-day backup artifact on every run | restore from a backup artifact (see below) |
| `data/raw`, `data/processed` (cached API responses) | GitHub Actions cache (private) | re-downloaded on the next run: ~62 CFBD calls, well inside the monthly budget |

## One-time setup

1. **Merge to `main`.** GitHub only runs scheduled workflows from the default branch:
   ```bash
   git checkout main && git merge ui-redesign && git push
   ```
2. **Add your API key** as a repo secret: GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**, name `CFBD_API_KEY`, value from your `.env`.
3. **Turn on Pages:** **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Seed the database** so the site starts with your full track record (from the repo root on your Mac):
   ```bash
   bash deploy/seed-data.sh
   ```
   This publishes `predictions.db` (the same predictions and results the site displays) as the `data` branch. The cached API responses are *not* uploaded; the first run re-downloads them.
5. **Run it:** **Actions → Refresh and deploy → Run workflow**. The first run takes longer (it rebuilds the API cache). When it finishes, the site is live at the URL above.
6. **Turn off the Mac's refresh**, so both don't spend CFBD calls and drift apart:
   ```bash
   launchctl bootout gui/$(id -u)/com.sportspredictor.refresh
   ```
   From then on the `data` branch is the source of truth. To work locally with the latest data: `git fetch origin data && git show origin/data:predictions.db > data/predictions.db`.

## After that

- **Updating the site:** push to `main`. That rebuilds and republishes from the current data without running a refresh (no API calls).
- **Refreshing on demand:** Actions → Refresh and deploy → Run workflow.
- **Checking runs:** the Actions tab shows each run's log. A league whose data source failed shows a warning, and the other leagues still update.
- **Restoring the database:** open a past run in the Actions tab, download its `predictions-db-…` artifact, unzip it to `data/predictions.db`, and run `bash deploy/seed-data.sh`.

## Things to know

- **NBA data:** the NBA's stats site blocks GitHub's servers, so the current NBA season comes from ESPN's free public feed instead (`src/sports/nba/espn.py`), and finished seasons ship in `data/history/nba/`. When a season ends, ship it before bumping `CURRENT_SEASON` in `config.py`: `python -m src.sports.nba.ingest --ship 2026`, then commit `data/history/nba/`.
- **Timing:** GitHub starts scheduled runs on a best-effort basis, so a refresh may land some minutes after `:05`, occasionally later at busy times.
- **Inactivity:** GitHub pauses scheduled workflows in a repo with no activity for 60 days. The workflow pushes the `data` branch every run, but if the schedule is ever paused, re-enable it from the Actions tab.
- **CFBD budget:** about 560 calls/month at this schedule (see `CFB_CACHE_MAX_AGE` in `src/refresh.py`).

## Local development

```bash
python -m src.export_static          # write frontend/public/data/ from your local database
cd frontend && npm run dev           # http://localhost:3000 (reads those files)
```

Without an export, the frontend falls back to mock data.
