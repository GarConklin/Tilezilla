"""Match player placements against catalog solves (progress.js parity)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional


def parse_board_size(level_id: str) -> tuple[int, int]:
    """Return (rows, cols) for a level id.

    Most ids encode rows×cols in the prefix. The readable ``5x6`` family is the
    exception: data uses rows=6, cols=5 (client ``rowsColsFromSizeKey``).
    """
    m = re.match(r"^(\d+)x(\d+)", str(level_id or ""))
    if not m:
        return 0, 0
    a, b = int(m.group(1)), int(m.group(2))
    if {a, b} == {5, 6}:
        return 6, 5
    return a, b


def board_size_from_solves(repo_root: Path, level_id: str) -> tuple[int, int]:
    """Prefer board.rows/cols from the solves doc when present."""
    solves_dir = repo_root / "solves"
    candidates = [solves_dir / f"{level_id}.json"]
    for bucket in (repo_root / "data" / "levels").glob("*.json"):
        try:
            doc = json.loads(bucket.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for lev in doc.get("levels") or []:
            if lev.get("id") != level_id:
                continue
            solves_file = str(lev.get("solvesFile") or "").strip()
            if solves_file:
                candidates.insert(0, solves_dir / solves_file)
            board = lev.get("board") if isinstance(lev.get("board"), dict) else None
            if board:
                rows = int(board.get("rows") or 0)
                cols = int(board.get("cols") or 0)
                if rows and cols:
                    return rows, cols
            break
    for path in candidates:
        if not path.is_file():
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        board = doc.get("board") if isinstance(doc, dict) else None
        if isinstance(board, dict):
            rows = int(board.get("rows") or 0)
            cols = int(board.get("cols") or 0)
            if rows and cols:
                return rows, cols
    return parse_board_size(level_id)


def playable_placements(placements: list[dict]) -> list[dict]:
    out = []
    for p in placements or []:
        tile = p.get("tile")
        if isinstance(tile, dict):
            tile = tile.get("id") or tile.get("tile") or ""
        tile = str(tile or "")
        if tile in ("B1", "B2", "SB"):
            continue
        out.append(
            {
                "tile": tile,
                "r": int(p.get("r") or 0),
                "c": int(p.get("c") or 0),
                "deg": int(p.get("deg") or 0) % 360,
            }
        )
    return out


def canonicalize(placements: list[dict]) -> str:
    normalized = []
    for p in playable_placements(placements):
        normalized.append(
            {
                "tile": p["tile"],
                "r": p["r"],
                "c": p["c"],
                "deg": ((p["deg"] % 360) + 360) % 360,
            }
        )
    normalized.sort(
        key=lambda x: (x["r"], x["c"], x["tile"], x["deg"]),
    )
    return json.dumps(normalized, separators=(",", ":"))


def mirror180(placements: list[dict], rows: int, cols: int) -> list[dict]:
    return [
        {
            "tile": p["tile"],
            "r": rows - 1 - p["r"],
            "c": cols - 1 - p["c"],
            "deg": (p["deg"] + 180) % 360,
        }
        for p in placements
    ]


def rotate90_cw(placements: list[dict], n: int) -> list[dict]:
    return [
        {
            "tile": p["tile"],
            "r": p["c"],
            "c": n - 1 - p["r"],
            "deg": (p["deg"] + 90) % 360,
        }
        for p in placements
    ]


def equivalence_key(placements: list[dict], rows: int, cols: int) -> str:
    playable = playable_placements(placements)
    if not rows or not cols:
        return canonicalize(playable)
    if rows == cols:
        cur = playable
        best = canonicalize(cur)
        for _ in range(3):
            cur = rotate90_cw(cur, rows)
            candidate = canonicalize(cur)
            if candidate < best:
                best = candidate
        return best
    a = canonicalize(playable)
    b = canonicalize(mirror180(playable, rows, cols))
    return a if a < b else b


def load_solves_file(repo_root: Path, level_id: str) -> list[dict]:
    solves_dir = repo_root / "solves"
    if not solves_dir.is_dir():
        return []
    direct = solves_dir / f"{level_id}.json"
    candidates = [direct]
    # Level catalog may reference a different solves file name.
    for bucket in (repo_root / "data" / "levels").glob("*.json"):
        try:
            doc = json.loads(bucket.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for lev in doc.get("levels") or []:
            if lev.get("id") != level_id:
                continue
            solves_file = str(lev.get("solvesFile") or "").strip()
            if solves_file:
                candidates.insert(0, solves_dir / solves_file)
            break
    for path in candidates:
        if not path.is_file():
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        raw = doc.get("solutions") if isinstance(doc, dict) else None
        if isinstance(raw, list):
            return raw
    return []


def solution_placements(solution: Any) -> list[dict]:
    if isinstance(solution, dict):
        raw = solution.get("placements")
        if isinstance(raw, list):
            return raw
    return []


def match_catalog(
    placements: list[dict],
    known_solutions: list[dict],
    rows: int,
    cols: int,
) -> tuple[Optional[int], bool]:
    """Return (0-based index or None, bonus)."""
    playable = playable_placements(placements)
    key_cur = equivalence_key(playable, rows, cols)
    for i, sol in enumerate(known_solutions):
        sol_placements = solution_placements(sol)
        key_sol = equivalence_key(sol_placements, rows, cols)
        if key_cur == key_sol:
            return i, False
    return None, True
