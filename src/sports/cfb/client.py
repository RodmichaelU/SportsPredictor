"""Thin CFBD API client: Bearer auth, retry/backoff, and disk caching.

Every response is cached to data/raw/ keyed by endpoint + params. Reruns read
from cache and make zero API calls for requests already made, which matters
on a 1,000-call/month free key.
"""

import hashlib
import json
import time

import requests

import config


class CFBDError(RuntimeError):
    pass


def _cache_key(endpoint: str, params: dict) -> str:
    normalized = json.dumps(params or {}, sort_keys=True)
    digest = hashlib.sha256(normalized.encode()).hexdigest()[:16]
    safe_endpoint = endpoint.strip("/").replace("/", "_")
    return f"{safe_endpoint}__{digest}.json"


def get(endpoint: str, params: dict | None = None, max_retries: int = 3) -> object:
    """GET a CFBD endpoint, serving from disk cache when available.

    endpoint: path like "/games" (leading slash optional).
    params: query params dict, used both in the request and the cache key.
    """
    params = params or {}
    cache_path = config.RAW_DIR / _cache_key(endpoint, params)

    if cache_path.exists():
        with open(cache_path) as f:
            return json.load(f)

    if not config.CFBD_API_KEY:
        raise CFBDError(
            "CFBD_API_KEY is not set. Add it to .env before making live API calls."
        )

    url = f"{config.CFBD_BASE_URL}/{endpoint.lstrip('/')}"
    headers = {"Authorization": f"Bearer {config.CFBD_API_KEY}"}

    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            if response.status_code == 429:
                time.sleep(2**attempt)
                continue
            response.raise_for_status()
            data = response.json()
            with open(cache_path, "w") as f:
                json.dump(data, f)
            return data
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(2**attempt)

    raise CFBDError(f"CFBD request to {endpoint} failed after {max_retries} retries: {last_error}")
