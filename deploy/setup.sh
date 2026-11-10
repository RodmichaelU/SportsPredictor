#!/usr/bin/env bash
# One-shot server setup for SportsPredictor on Ubuntu 24.04 (x86 or ARM).
# Run from the repo root on the server, as a sudo-capable user:
#
#   bash deploy/setup.sh <domain>        e.g. bash deploy/setup.sh 129-146-10-20.sslip.io
#
# Safe to re-run: re-running after a `git pull` is also how you deploy updates
# (reinstalls dependencies, rebuilds the frontend, restarts the services).
set -euo pipefail

DOMAIN="${1:?usage: bash deploy/setup.sh <domain>}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER="$(id -un)"

echo "==> Deploying $APP_DIR as $APP_USER for https://$DOMAIN"

if [[ ! -f "$APP_DIR/.env" ]] || ! grep -q '^CFBD_API_KEY=.\+' "$APP_DIR/.env"; then
  echo "Missing $APP_DIR/.env with CFBD_API_KEY=... (copy it from your Mac; it's gitignored)." >&2
  exit 1
fi

echo "==> System packages"
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-venv python3-pip git curl debian-keyring debian-archive-keyring apt-transport-https libgomp1

if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  echo "==> Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi

if ! command -v caddy >/dev/null; then
  echo "==> Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy
fi

echo "==> Python environment"
# The code parses ISO timestamps ending in "Z", which needs Python 3.11+
# (Ubuntu 24.04 ships 3.12; 22.04's 3.10 is too old).
if ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
  echo "Python 3.11+ required (found $(python3 --version)). Use Ubuntu 24.04." >&2
  exit 1
fi
cd "$APP_DIR"
[[ -d .venv ]] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
mkdir -p data/raw data/processed data/logs

echo "==> Frontend build"
cd "$APP_DIR/frontend"
npm ci --silent
# Baked in at build time; the browser (parlay builder) and the server both
# reach the API through Caddy at /api.
NEXT_PUBLIC_API_URL="https://$DOMAIN/api" npm run build

echo "==> systemd services"
for unit in sportspredictor-api.service sportspredictor-web.service sportspredictor-refresh.service sportspredictor-refresh.timer; do
  sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__USER__|$APP_USER|g" "$APP_DIR/deploy/systemd/$unit" \
    | sudo tee "/etc/systemd/system/$unit" >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now sportspredictor-api.service sportspredictor-web.service sportspredictor-refresh.timer
sudo systemctl restart sportspredictor-api.service sportspredictor-web.service

echo "==> Caddy (HTTPS)"
sed "s|{\$DOMAIN}|$DOMAIN|" "$APP_DIR/deploy/Caddyfile" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy || sudo systemctl restart caddy

# Oracle Cloud's Ubuntu images ship iptables rules that reject everything but
# SSH; open 80/443 if that's the case here (no-op elsewhere).
if command -v netfilter-persistent >/dev/null && ! sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
  echo "==> Opening ports 80/443 in iptables"
  sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save
fi

echo
echo "Done. Checks:"
echo "  curl -s https://$DOMAIN/api/sports"
echo "  systemctl list-timers sportspredictor-refresh.timer"
echo "  journalctl -u sportspredictor-refresh -n 20"
echo "Site: https://$DOMAIN"
