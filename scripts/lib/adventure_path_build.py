"""Build adventure path JSON consumed by web/js/adventure-path.js."""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

STEPS_PER_RANK = 10


def step_to_rank_sub(step_index: int) -> Tuple[int, int]:
    rank_id = step_index // STEPS_PER_RANK + 1
    sub_level = step_index % STEPS_PER_RANK + 1
    return rank_id, sub_level


def load_map_entries_from_csv(map_path: Path) -> List[dict]:
    entries: List[dict] = []
    with map_path.open(encoding="utf-8-sig", newline="") as f:
        for line_no, raw in enumerate(csv.DictReader(f)):
            adv_raw = (raw.get("Adv_ID") or "").strip()
            level_id = (raw.get("level_id") or "").strip()
            if not adv_raw or not level_id:
                continue
            entries.append(
                {
                    "advId": int(adv_raw),
                    "line": line_no,
                    "levelId": level_id,
                    "isChallenge": (raw.get("CH-lvl") or "").strip().upper() == "T",
                }
            )
    entries.sort(key=lambda e: (e["advId"], e["line"]))
    return entries


def build_adventure_path_from_entries(entries: List[dict]) -> dict:
    challenge_adv_ids = sorted(e["advId"] for e in entries if e["isChallenge"])
    steps: List[dict] = []
    flat: List[dict] = []
    prev_adv = 0

    for step_index, end_adv in enumerate(challenge_adv_ids):
        rank_id, sub_level = step_to_rank_sub(step_index)
        step_entries = [
            e for e in entries if prev_adv < e["advId"] <= end_adv
        ]
        step_entries.sort(key=lambda e: (e["advId"], e["line"]))

        puzzles = []
        for order_idx, entry in enumerate(step_entries):
            puzzle = {
                "advId": entry["advId"],
                "levelId": entry["levelId"],
                "puzzleOrder": order_idx + 1,
                "isChallenge": entry["isChallenge"],
                "stepIndex": step_index,
                "rankId": rank_id,
                "subLevel": sub_level,
                "flatIndex": len(flat),
            }
            flat.append(puzzle)
            puzzles.append(puzzle)

        steps.append(
            {
                "stepIndex": step_index,
                "rankId": rank_id,
                "subLevel": sub_level,
                "puzzles": puzzles,
            }
        )
        prev_adv = end_adv

    postgame = []
    trailing = [e for e in entries if e["advId"] > prev_adv]
    trailing.sort(key=lambda e: (e["advId"], e["line"]))
    for order_idx, entry in enumerate(trailing):
        postgame.append(
            {
                "advId": entry["advId"],
                "levelId": entry["levelId"],
                "puzzleOrder": order_idx + 1,
                "isChallenge": entry["isChallenge"],
                "flatIndex": len(flat) + order_idx,
            }
        )

    return {
        "steps": steps,
        "postgame": postgame,
        "flat": flat,
        "stepCount": len(steps),
    }


def build_adventure_path_document(
    path: dict,
    *,
    source: str,
    map_csv: Optional[str] = None,
) -> dict:
    return {
        "schema": "adventure-path-v1",
        "source": source,
        "mapCsv": map_csv,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "stepCount": path["stepCount"],
        "steps": path["steps"],
        "postgame": path["postgame"],
        "flat": path["flat"],
    }


def build_adventure_path_from_csv(map_path: Path, source: Optional[str] = None) -> dict:
    entries = load_map_entries_from_csv(map_path)
    path = build_adventure_path_from_entries(entries)
    return build_adventure_path_document(
        path,
        source=source or "adventure_solution_distribution.csv",
        map_csv=map_path.name,
    )


def build_adventure_path_from_mysql_rows(
    ranked_rows: List[dict],
    postgame_rows: List[dict],
) -> dict:
    """Build path from adventure_puzzle + adventure_postgame_puzzle query rows."""
    steps_map: Dict[Tuple[int, int], List[dict]] = {}
    flat: List[dict] = []

    for row in ranked_rows:
        rank_id = int(row["rank_id"])
        sub_level = int(row["sub_level"])
        step_index = (rank_id - 1) * STEPS_PER_RANK + (sub_level - 1)
        puzzle = {
            "advId": row.get("adv_id"),
            "levelId": row["level_id"],
            "puzzleOrder": int(row["puzzle_order"]),
            "isChallenge": bool(row["is_challenge"]),
            "stepIndex": step_index,
            "rankId": rank_id,
            "subLevel": sub_level,
            "flatIndex": len(flat),
        }
        flat.append(puzzle)
        steps_map.setdefault((rank_id, sub_level), []).append(puzzle)

    steps = []
    for (rank_id, sub_level), puzzles in sorted(steps_map.items()):
        step_index = (rank_id - 1) * STEPS_PER_RANK + (sub_level - 1)
        puzzles.sort(key=lambda p: p["puzzleOrder"])
        steps.append(
            {
                "stepIndex": step_index,
                "rankId": rank_id,
                "subLevel": sub_level,
                "puzzles": puzzles,
            }
        )
    steps.sort(key=lambda s: s["stepIndex"])

    postgame = []
    for row in postgame_rows:
        postgame.append(
            {
                "advId": int(row["adv_id"]),
                "levelId": row["level_id"],
                "puzzleOrder": int(row["puzzle_order"]),
                "isChallenge": bool(row["is_challenge"]),
                "flatIndex": len(flat) + len(postgame),
            }
        )

    path = {
        "steps": steps,
        "postgame": postgame,
        "flat": flat,
        "stepCount": len(steps),
    }
    return build_adventure_path_document(path, source="mysql")


def load_adventure_path_from_mysql(repo_root: Path) -> Optional[dict]:
    try:
        import pymysql  # type: ignore
    except ImportError:
        return None

    import os

    try:
        conn = pymysql.connect(
            host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
            port=int(os.environ.get("MYSQL_PORT", "3306")),
            user=os.environ.get("MYSQL_USER", "tilegame"),
            password=os.environ.get("MYSQL_PASSWORD", "tilegame_dev"),
            database=os.environ.get("MYSQL_DATABASE", "tilegame"),
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
    except Exception:
        return None

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT rank_id, sub_level, puzzle_order, level_id, is_challenge
                FROM adventure_puzzle
                ORDER BY rank_id, sub_level, puzzle_order
                """
            )
            ranked = cur.fetchall()
            cur.execute(
                """
                SELECT puzzle_order, adv_id, level_id, is_challenge
                FROM adventure_postgame_puzzle
                ORDER BY puzzle_order
                """
            )
            postgame = cur.fetchall()
        if not ranked:
            return None
        return build_adventure_path_from_mysql_rows(ranked, postgame)
    except Exception:
        return None
    finally:
        conn.close()
