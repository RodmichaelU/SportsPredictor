"""Live odds from Kalshi, a CFTC-regulated real-money prediction market --
free and public, no API key needed to read current market prices. Used to
compare our model's predictions against genuinely live market pricing, as
opposed to CFBD's closing_spread (a single frozen post-game snapshot) or
nflreadpy's spread_line (the closing line, same idea).

Checked live against the real API while building this: no auth required for
GET /markets, and both leagues have individual game markets --
KXNFLGAME (all 32 teams, exact abbreviation match with nflreadpy except
Jacksonville: Kalshi uses JAC, nflreadpy uses JAX) and KXNCAAFGAME (~100
open games at a time, team names spelled out e.g. "Stanford wins", close
but not identical to CFBD's naming -- "App State" vs "Appalachian St.",
"San José State" vs "San Jose St.", etc.).

Docs: https://docs.kalshi.com
"""

import re
import unicodedata

import requests

BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"

SERIES_TICKER = {"cfb": "KXNCAAFGAME", "nfl": "KXNFLGAME"}

# Kalshi's ticker code -> nflreadpy's team_abbr. Verified by diffing the full
# set of both. LA is nflreadpy's current code for the Rams (not LAR, despite
# LAR also existing in its historical team list) -- confirmed by an actual
# match failure against a real Rams game while building this, not assumed.
NFL_CODE_ALIASES = {"JAC": "JAX", "LAR": "LA"}

# Kalshi's team name (lowercased, as written before the generic " st." ->
# " state" pass below) -> CFBD's team name (lowercased). Found by diffing
# Kalshi's ~265 open CFB team names against CFBD's ~240 FBS team names;
# everything else already matches once "St." is expanded to "State" and
# accents are stripped. Residual misses are almost entirely FCS-only teams
# that never appear in our FBS-vs-FBS feature table anyway.
CFB_NAME_ALIASES = {
    "appalachian st.": "app state",
    "san jose st.": "san jose state",
    "miami (fl)": "miami",
    "louisiana-monroe": "ul monroe",
}


def _normalize_cfb_name(name: str) -> str:
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    n = n.lower().strip()
    n = CFB_NAME_ALIASES.get(n, n)
    n = re.sub(r"\bst\.", "state", n)
    n = re.sub(r"[^a-z0-9 ]", "", n)
    return re.sub(r"\s+", " ", n).strip()


def _team_key_for_name(sport: str, team_name: str) -> str:
    if sport == "nfl":
        return NFL_CODE_ALIASES.get(team_name, team_name)
    return _normalize_cfb_name(team_name)


def _team_key_for_market(sport: str, market: dict) -> str:
    if sport == "nfl":
        code = market["ticker"].rsplit("-", 1)[-1]
        return NFL_CODE_ALIASES.get(code, code)
    return _normalize_cfb_name(market["yes_sub_title"])


def fetch_open_markets(sport: str) -> list[dict]:
    series = SERIES_TICKER.get(sport)
    if not series:
        return []
    markets: list[dict] = []
    cursor = None
    for _ in range(10):  # generous cap; one page (200) covers a full NFL week
        params = {"series_ticker": series, "status": "open", "limit": 200}
        if cursor:
            params["cursor"] = cursor
        response = requests.get(f"{BASE_URL}/markets", params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        markets.extend(data.get("markets", []))
        cursor = data.get("cursor")
        if not cursor:
            break
    return markets


def build_index(sport: str) -> dict[str, dict[str, dict]]:
    """event_ticker -> {team_key: market}. Fetch once per request and reuse
    across every game being matched, rather than re-fetching per game."""
    events: dict[str, dict[str, dict]] = {}
    for market in fetch_open_markets(sport):
        key = _team_key_for_market(sport, market)
        events.setdefault(market["event_ticker"], {})[key] = market
    return events


def _implied_probability(market: dict) -> float | None:
    """Midpoint of the live bid/ask when the market has active quotes on
    both sides (the honest read on current price); falls back to the last
    traded price for a thin market with no current quotes on one side."""
    bid = float(market.get("yes_bid_dollars") or 0)
    ask = float(market.get("yes_ask_dollars") or 0)
    if bid > 0 and ask > 0:
        return (bid + ask) / 2
    last = float(market.get("last_price_dollars") or 0)
    return last if last > 0 else None


def match_game(sport: str, home_team: str, away_team: str, index: dict) -> dict | None:
    home_key = _team_key_for_name(sport, home_team)
    away_key = _team_key_for_name(sport, away_team)
    for event in index.values():
        if home_key in event and away_key in event:
            home_market, away_market = event[home_key], event[away_key]
            home_p = _implied_probability(home_market)
            away_p = _implied_probability(away_market)
            if home_p is None or away_p is None:
                return None
            return {
                "home_probability": home_p,
                "away_probability": away_p,
                "volume": float(home_market.get("volume_fp") or 0) + float(away_market.get("volume_fp") or 0),
                "event_ticker": home_market["event_ticker"],
            }
    return None
