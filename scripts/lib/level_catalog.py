"""Lookup a single level row from sharded catalog buckets."""

from __future__ import annotations

import json
import re
from pathlib import Path

_LEVEL_ID_RE = re.compile(r"^(\d+x\d+)-(\d[A-Z])-", re.IGNORECASE)


def bucket_file_for_level_id(level_id: str) -> str | None:
    match = _LEVEL_ID_RE.match(str(level_id or "").strip().replace(".json", ""))
    if not match:
        return None
    return f"{match.group(1)}-{match.group(2)}.json"


def lookup_level(root: Path, level_id: str) -> dict | None:
    """Return one catalog level dict or None."""
    norm = str(level_id or "").strip().replace(".json", "")
    if not norm:
        return None
    bucket_file = bucket_file_for_level_id(norm)
    if not bucket_file:
        return None
    bucket_path = root / "data" / "levels" / bucket_file
    if not bucket_path.is_file():
        return None
    try:
        doc = json.loads(bucket_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    for level in doc.get("levels") or []:
        if isinstance(level, dict) and level.get("id") == norm:
            return level
    return None
