#!/usr/bin/env bash
# One-time: publish your current data/predictions.db as the `data` branch the
# GitHub workflow restores from, so the deployed site starts with the full
# track record instead of an empty database. Run from the repo root on the
# machine that has the database (your Mac). Overwrites the remote `data`
# branch -- only run this before the workflow's first refresh, or to restore
# from a backup.
set -euo pipefail

DB="data/predictions.db"
[[ -f "$DB" ]] || { echo "No $DB here -- run from the repo root." >&2; exit 1; }
REMOTE="$(git remote get-url origin)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
sqlite3 "$DB" ".backup '$tmp/predictions.db'" 2>/dev/null || cp "$DB" "$tmp/predictions.db"

cd "$tmp"
git init -q -b data
git add predictions.db
git commit -q -m "Seed data from local database"
git push -f "$REMOTE" data
echo "Seeded the data branch with $(sqlite3 predictions.db 'SELECT COUNT(*) FROM predictions' 2>/dev/null || echo '?') predictions."
