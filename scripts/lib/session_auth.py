"""Verify PHP session cookie via auth upstream."""

from __future__ import annotations

import json
import os
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

_AUTH_HOST_PORT = os.environ.get("AUTH_PORT", "8090")
AUTH_UPSTREAM = os.environ.get(
    "AUTH_UPSTREAM",
    f"http://127.0.0.1:{_AUTH_HOST_PORT}",
).rstrip("/")


def verify_session_cookie(cookie_header: str) -> Optional[dict[str, Any]]:
    """Return authenticated user dict {id, username, ...} or None."""
    if not cookie_header or not AUTH_UPSTREAM:
        return None
    url = f"{AUTH_UPSTREAM}/api/check-session.php"
    req = Request(url, headers={"Cookie": cookie_header, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError, OSError):
        return None
    if not payload.get("authenticated") or payload.get("user", {}).get("id") is None:
        return None
    return payload["user"]
