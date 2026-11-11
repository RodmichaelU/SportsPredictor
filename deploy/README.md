# Deploying SportsPredictor

One always-on Linux server runs everything the Mac runs today:

| What | Runs as | Replaces on the Mac |
|---|---|---|
| API (FastAPI) | `sportspredictor-api` service, 127.0.0.1:8000 | `uvicorn` in a terminal |
| Website (Next.js) | `sportspredictor-web` service, 127.0.0.1:3000 | `npm run dev` |
| Refresh every 3 hours (freeze picks, grade results, save prices, early lines) | `sportspredictor-refresh.timer` | the launchd agent |
| HTTPS + routing | Caddy: `/api/*` → API, everything else → website | — |
| Data (`data/`: SQLite DB, API cache) | the server's disk | the Mac's disk |

Results stay up to date because the timer runs the same `python -m src.refresh --all` every 3 hours (00:05, 03:05, … US Central), and every page is rendered on request from the database it writes to. A slot missed while the server was down runs as soon as it's back.

Everything here is free: Oracle Cloud's Always Free tier for the server, a free `sslip.io` hostname for HTTPS, and the same free data sources as today.

## 1. Create the server

1. Sign up for Oracle Cloud (Always Free) and create a **Compute instance**: image **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (Ampere, Always Free eligible), 1–2 OCPUs and 6–12 GB RAM is plenty. Add your SSH public key.
2. In the instance's **Virtual Cloud Network → Security List**, add ingress rules for TCP ports **80** and **443** from `0.0.0.0/0`. (The setup script opens them on the server's own firewall too.)
3. Note the instance's **public IP**, e.g. `129.146.10.20`.

Any Ubuntu 24.04 VPS works the same way; Oracle is just the free one.

## 2. Pick a hostname

No domain needed: `<public-ip-with-dashes>.sslip.io` resolves to your server, and Caddy gets a real HTTPS certificate for it automatically.

```
129.146.10.20  →  129-146-10-20.sslip.io
```

(If you own a domain, point an A record at the IP and use that instead.)

## 3. Put the code, secret, and data on the server

On the server:

```bash
git clone https://github.com/RodmichaelU/SportsPredictor.git
cd SportsPredictor
git checkout ui-redesign   # or main, once ui-redesign is merged
```

From your Mac (repo root), copy the two things git doesn't carry:

```bash
scp .env ubuntu@129.146.10.20:SportsPredictor/.env
rsync -a --info=progress2 data/ ubuntu@129.146.10.20:SportsPredictor/data/
```

**Don't skip the `data/` copy.** It holds every frozen prediction and graded result (the track record can't be rebuilt), and the cached API responses. Starting with an empty `data/` would re-download every past season from CFBD and blow through the 1,000-calls/month free tier.

## 4. Run setup

On the server, from the repo root:

```bash
bash deploy/setup.sh 129-146-10-20.sslip.io
```

It installs Python, Node 20, and Caddy, builds the site, installs the services and timer, and configures HTTPS. Then check:

```bash
curl -s https://129-146-10-20.sslip.io/api/sports       # API answers through Caddy
systemctl list-timers sportspredictor-refresh.timer      # next refresh time
sudo systemctl start sportspredictor-refresh             # run one refresh now
journalctl -u sportspredictor-refresh -n 20              # its output
```

Open `https://129-146-10-20.sslip.io`.

## 5. Turn off the Mac's refresh

Once the server is refreshing, stop the Mac's launchd agent, or both machines will spend CFBD calls and their databases will drift apart:

```bash
launchctl bootout gui/$(id -u)/com.sportspredictor.refresh
```

From then on the server's `data/predictions.db` is the source of truth.

## Updating

Push changes to GitHub, then on the server:

```bash
cd SportsPredictor && git pull && bash deploy/setup.sh 129-146-10-20.sslip.io
```

## Keeping an eye on it

- **Refresh log:** `journalctl -u sportspredictor-refresh --since today`. A run where any league failed exits non-zero, so `systemctl status sportspredictor-refresh` shows it as failed.
- **Backups:** the database is the one irreplaceable file. Pull a copy to your Mac now and then:
  ```bash
  ssh ubuntu@129.146.10.20 'sqlite3 SportsPredictor/data/predictions.db ".backup /tmp/predictions.db"'
  scp ubuntu@129.146.10.20:/tmp/predictions.db ~/predictions-backup-$(date +%F).db
  ```
- **Kalshi:** if Kalshi blocks the server's network, the site keeps working on the latest saved prices (and says so), same as on a blocked Wi-Fi.
- **CFBD budget:** about 560 calls/month at this schedule (see `CFB_CACHE_MAX_AGE` in `src/refresh.py`); CFBD's account page shows actual usage.
