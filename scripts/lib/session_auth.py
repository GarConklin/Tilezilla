"""Verify PHP session cookie via auth upstream."""

from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

_AUTH_HOST_PORT = os.environ.get("AUTH_PORT", "8090")
AUTH_UPSTREAM = os.environ.get(
    "AUTH_UPSTREAM",
    f"http://127.0.0.1:{_AUTH_HOST_PORT}",
).rstrip("/")

# Short TTL: collapses bursty check-session traffic (solve + hints + 30s refresh).
_SESSION_CACHE_TTL_SEC = float(os.environ.get("AUTH_SESSION_CACHE_TTL", "8"))
_session_cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}


def _cookie_cache_key(cookie_header: str) -> str:
    return hashlib.sha256(cookie_header.encode("utf-8", errors="ignore")).hexdigest()


def verify_session_cookie(cookie_header: str) -> Optional[dict[str, Any]]:
    """Return authenticated user dict {id, username, ...} or None."""
    if not cookie_header or not AUTH_UPSTREAM:
        return None

    cache_key = _cookie_cache_key(cookie_header)
    now = time.monotonic()
    cached = _session_cache.get(cache_key)
    if cached and (now - cached[0]) < _SESSION_CACHE_TTL_SEC:
        return cached[1]

    url = f"{AUTH_UPSTREAM}/api/check-session.php"
    req = Request(url, headers={"Cookie": cookie_header, "Accept": "application/json"})
    user: Optional[dict[str, Any]] = None
    try:
        with urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        if payload.get("authenticated") and payload.get("user", {}).get("id") is not None:
            user = payload["user"]
    except (HTTPError, URLError, json.JSONDecodeError, OSError):
        user = None

    _session_cache[cache_key] = (now, user)
    # Bound memory if many distinct cookies show up.
    if len(_session_cache) > 512:
        cutoff = now - _SESSION_CACHE_TTL_SEC
        stale = [k for k, (ts, _) in _session_cache.items() if ts < cutoff]
        for k in stale:
            _session_cache.pop(k, None)
    return user
