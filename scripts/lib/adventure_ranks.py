"""Canonical adventure rank metadata (see data/adventure_ranks.json)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, TypedDict

ADVENTURE_RANK_COUNT = 9


class AdventureRank(TypedDict):
    rank_id: int
    rank_code: str
    rank_name: str
    rank_description: str
    badge_image: str
    sublevel_badge: str
    display_order: int


def adventure_ranks_path(repo_root: Path | None = None) -> Path:
    root = repo_root or Path(__file__).resolve().parents[2]
    return root / "data" / "adventure_ranks.json"


def load_adventure_ranks(repo_root: Path | None = None) -> List[AdventureRank]:
    path = adventure_ranks_path(repo_root)
    with path.open(encoding="utf-8") as f:
        rows = json.load(f)
    if len(rows) != ADVENTURE_RANK_COUNT:
        raise ValueError(
            f"Expected {ADVENTURE_RANK_COUNT} adventure ranks in {path}, got {len(rows)}"
        )
    return rows
