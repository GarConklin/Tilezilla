#!/usr/bin/env python3
"""Import Adventure puzzle map + progression into MySQL.

Authoritative source: data/adventure_solution_distribution.csv
  Adv_ID     → global adventure sequence
  CH-lvl=T   → ends an adventure step (challenge puzzle); 80 steps total
  level_id   → FK target in levels

Step identity (L1-1 … L8-10) is derived from challenge order in the CSV:
  step 1 → L1-1, step 10 → L1-10, step 11 → L2-1, … step 80 → L8-10

Rows after the last CH-lvl=T → adventure_postgame_puzzle (play after L8-10).

Populates:
  adventure_rank, adventure_progression, adventure_puzzle, adventure_postgame_puzzle

  python scripts/import-adventure-map.py
  python scripts/import-adventure-map.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path
from typing import List, Tuple

try:
    import pymysql
except ImportError:
    pymysql = None  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.adventure_ranks import load_adventure_ranks

RANK_COUNT = 8
STEPS_PER_RANK = 10


def connect():
    if pymysql is None:
        raise SystemExit("pymysql is required: pip install pymysql")
    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "tilegame"),
        password=os.environ.get("MYSQL_PASSWORD", "tilegame_dev"),
        database=os.environ.get("MYSQL_DATABASE", "tilegame"),
        charset="utf8mb4",
        autocommit=False,
    )


def step_to_rank_sub(step_index: int) -> Tuple[int, int]:
    """Map 0-based step index to (rank_id, sub_level) for L1-1 … L8-10."""
    rank_id = step_index // STEPS_PER_RANK + 1
    sub_level = step_index % STEPS_PER_RANK + 1
    if rank_id < 1 or rank_id > RANK_COUNT:
        raise ValueError(f"Step index {step_index} out of range for 8 ranks")
    return rank_id, sub_level


def required_solution_count(entry: dict) -> int:
    if entry["is_challenge"]:
        req = entry["total_unique_solutions"] or entry["solve_count"] or 1
        return max(req, 1)
    return 1


def load_map_entries(map_path: Path) -> List[dict]:
    entries: List[dict] = []
    with map_path.open(encoding="utf-8-sig", newline="") as f:
        for line_no, raw in enumerate(csv.DictReader(f)):
            adv_raw = (raw.get("Adv_ID") or "").strip()
            level_id = (raw.get("level_id") or "").strip()
            if not adv_raw or not level_id:
                continue
            entries.append(
                {
                    "adv_id": int(adv_raw),
                    "line": line_no,
                    "level_id": level_id,
                    "is_challenge": (raw.get("CH-lvl") or "").strip().upper() == "T",
                    "total_unique_solutions": int(raw.get("total_unique_solutions") or 0),
                    "solve_count": int(raw.get("solve_count") or 0),
                }
            )
    entries.sort(key=lambda e: (e["adv_id"], e["line"]))
    return entries


def build_adventure_rows(
    entries: List[dict],
) -> Tuple[List[dict], List[dict], List[dict], List[str]]:
    challenge_adv = sorted(e["adv_id"] for e in entries if e["is_challenge"])
    if len(challenge_adv) != 80:
        raise SystemExit(f"Expected 80 CH-lvl=T rows, got {len(challenge_adv)}")

    warnings: List[str] = []
    progression: List[dict] = []
    puzzles: List[dict] = []
    postgame: List[dict] = []
    prev_adv = 0
    cumulative = 0

    for step_idx, end_adv in enumerate(challenge_adv):
        rank_id, sub_level = step_to_rank_sub(step_idx)

        step_entries = [e for e in entries if prev_adv < e["adv_id"] <= end_adv]
        step_entries.sort(key=lambda e: (e["adv_id"], e["line"]))
        if not step_entries:
            raise SystemExit(
                f"Empty step L{rank_id}-{sub_level} (adv {prev_adv + 1}..{end_adv})"
            )

        challenges = [e for e in step_entries if e["is_challenge"]]
        if len(challenges) != 1:
            raise SystemExit(
                f"Step L{rank_id}-{sub_level} must have exactly one T row; got {len(challenges)}"
            )

        actual = len(step_entries)
        cumulative += actual
        progression.append(
            {
                "rank_id": rank_id,
                "sub_level": sub_level,
                "levels_required": actual,
                "cumulative_levels_required": cumulative,
            }
        )

        for order, entry in enumerate(step_entries, start=1):
            puzzles.append(
                {
                    "rank_id": rank_id,
                    "sub_level": sub_level,
                    "puzzle_order": order,
                    "level_id": entry["level_id"],
                    "is_challenge": entry["is_challenge"],
                    "required_solution_count": required_solution_count(entry),
                }
            )

        prev_adv = end_adv

    trailing = [e for e in entries if e["adv_id"] > prev_adv]
    trailing.sort(key=lambda e: (e["adv_id"], e["line"]))
    for order, entry in enumerate(trailing, start=1):
        postgame.append(
            {
                "puzzle_order": order,
                "adv_id": entry["adv_id"],
                "level_id": entry["level_id"],
                "is_challenge": entry["is_challenge"],
                "required_solution_count": required_solution_count(entry),
            }
        )

    return progression, puzzles, postgame, warnings


def upsert_ranks(cur, repo_root: Path) -> None:
    sql = """
        INSERT INTO adventure_rank (
            rank_id, rank_code, rank_name, badge_name, badge_image,
            badge_locked_image, badge_color, unlock_title, unlock_message,
            display_order, is_active
        ) VALUES (%s, %s, %s, %s, %s, NULL, NULL, NULL, NULL, %s, TRUE)
        ON DUPLICATE KEY UPDATE
            rank_code = VALUES(rank_code),
            rank_name = VALUES(rank_name),
            badge_name = VALUES(badge_name),
            badge_image = VALUES(badge_image),
            display_order = VALUES(display_order),
            is_active = VALUES(is_active)
    """
    for row in load_adventure_ranks(repo_root):
        cur.execute(
            sql,
            (
                row["rank_id"],
                row["rank_code"],
                row["rank_name"],
                row["rank_name"],
                row["badge_image"],
                row["display_order"],
            ),
        )


def upsert_progression(cur, rows: List[dict]) -> None:
    sql = """
        INSERT INTO adventure_progression (
            rank_id, sub_level, levels_required, cumulative_levels_required
        ) VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            levels_required = VALUES(levels_required),
            cumulative_levels_required = VALUES(cumulative_levels_required)
    """
    for row in rows:
        cur.execute(
            sql,
            (
                row["rank_id"],
                row["sub_level"],
                row["levels_required"],
                row["cumulative_levels_required"],
            ),
        )


def replace_puzzles(cur, rows: List[dict]) -> None:
    cur.execute("DELETE FROM adventure_puzzle")
    sql = """
        INSERT INTO adventure_puzzle (
            rank_id, sub_level, puzzle_order, level_id,
            is_challenge, required_solution_count
        ) VALUES (%s, %s, %s, %s, %s, %s)
    """
    for row in rows:
        cur.execute(
            sql,
            (
                row["rank_id"],
                row["sub_level"],
                row["puzzle_order"],
                row["level_id"],
                row["is_challenge"],
                row["required_solution_count"],
            ),
        )


def replace_postgame(cur, rows: List[dict]) -> None:
    cur.execute("DELETE FROM adventure_postgame_puzzle")
    sql = """
        INSERT INTO adventure_postgame_puzzle (
            puzzle_order, adv_id, level_id, is_challenge, required_solution_count
        ) VALUES (%s, %s, %s, %s, %s)
    """
    for row in rows:
        cur.execute(
            sql,
            (
                row["puzzle_order"],
                row["adv_id"],
                row["level_id"],
                row["is_challenge"],
                row["required_solution_count"],
            ),
        )


def main() -> None:
    ap = argparse.ArgumentParser(description="Import adventure map CSV into MySQL.")
    ap.add_argument(
        "--csv",
        default="data/adventure_solution_distribution.csv",
        help="Adventure puzzle map CSV path",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    map_path = (root / args.csv).resolve()
    if not map_path.exists():
        raise SystemExit(f"CSV not found: {map_path}")

    entries = load_map_entries(map_path)
    progression, puzzles, postgame, warnings = build_adventure_rows(entries)

    print(f"CSV: {map_path}")
    print(f"CSV rows: {len(entries)}")
    print(f"progression steps: {len(progression)}")
    print(f"progression puzzles: {len(puzzles)}")
    print(f"postgame puzzles (after L8-10): {len(postgame)}")
    print(f"total imported: {len(puzzles) + len(postgame)}")
    print(f"challenges: {sum(1 for p in puzzles if p['is_challenge'])}")
    print(
        f"cumulative at L8-10: {progression[-1]['cumulative_levels_required']} "
        f"(levels_required={progression[-1]['levels_required']})"
    )
    if postgame:
        print(
            f"postgame Adv_ID range: {postgame[0]['adv_id']}..{postgame[-1]['adv_id']}"
        )
    if warnings:
        print(f"warnings ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")

    if args.dry_run:
        return

    conn = connect()
    try:
        with conn.cursor() as cur:
            upsert_ranks(cur, root)
            upsert_progression(cur, progression)
            replace_puzzles(cur, puzzles)
            replace_postgame(cur, postgame)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM adventure_rank")
            ranks_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_progression")
            prog_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_puzzle")
            puzzle_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_postgame_puzzle")
            post_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_puzzle WHERE is_challenge = TRUE")
            ch_n = cur.fetchone()[0]
            print(f"db adventure_rank: {ranks_n}")
            print(f"db adventure_progression: {prog_n}")
            print(f"db adventure_puzzle: {puzzle_n} ({ch_n} challenges)")
            print(f"db adventure_postgame_puzzle: {post_n}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
