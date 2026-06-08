#!/usr/bin/env python3
"""Upsert catalog levels (and optional daily schedule) into MySQL tilegame DB.

Canonical solve layouts stay in solves/*.json — not stored in MySQL V1.
This script loads level metadata + total_unique_solutions from solve files.

Requires pymysql and MYSQL_* env (host mysql from web container, 127.0.0.1 from host).

  python scripts/import-catalog-to-mysql.py
  python scripts/import-catalog-to-mysql.py --dry-run
  python scripts/import-catalog-to-mysql.py --levels-only
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple

try:
    import pymysql
except ImportError:
    pymysql = None  # type: ignore


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def solve_count_for_level(root: Path, solves_file: str) -> int:
    if not solves_file:
        return 0
    p = root / "solves" / solves_file
    if not p.exists():
        return 0
    doc = read_json(p)
    if isinstance(doc.get("totalUniqueSolutions"), int):
        return int(doc["totalUniqueSolutions"])
    sols = doc.get("solutions")
    if isinstance(sols, list):
        return len(sols)
    return 0


def level_row(root: Path, lv: dict) -> Tuple:
    level_id = str(lv.get("id", ""))
    parts = level_id.split("-")
    tier = parts[1] if len(parts) >= 2 else ""
    board = lv.get("board") or {}
    board_width = int(board.get("cols") or 0)
    board_height = int(board.get("rows") or 0)
    solves_file = str(lv.get("solvesFile") or f"{level_id}.json")
    from_solve = solve_count_for_level(root, solves_file)
    from_catalog = int(lv.get("totalUniqueSolutions") or 0)
    total_unique = from_solve if from_solve > 0 else from_catalog
    # daily_eligible synced from daily_challenges after import (reserved for daily, not adventure)
    return (
        level_id,
        board_width,
        board_height,
        tier,
        total_unique,
        False,
        None,
    )


def load_daily_rows(root: Path) -> List[Tuple]:
    csv_path = root / "data" / "daily_challenges_import.csv"
    rows: List[Tuple] = []
    with csv_path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            lid = str(row.get("level_id", "")).strip().replace(".json", "")
            notes = (row.get("notes") or "").strip() or None
            rows.append(
                (
                    row["challenge_date"],
                    lid,
                    int(row["total_solutions"]),
                    notes,
                )
            )
    return rows


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


def batched(items: List, size: int) -> Iterable[List]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def upsert_levels(cur, rows: List[Tuple]) -> None:
    sql = """
        INSERT INTO levels (
            level_id, board_width, board_height, tier,
            total_unique_solutions, daily_eligible, target_time_seconds
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            board_width = VALUES(board_width),
            board_height = VALUES(board_height),
            tier = VALUES(tier),
            total_unique_solutions = VALUES(total_unique_solutions),
            daily_eligible = VALUES(daily_eligible),
            target_time_seconds = VALUES(target_time_seconds)
    """
    for chunk in batched(rows, 250):
        cur.executemany(sql, chunk)


def sync_daily_eligible_from_challenges(cur) -> Tuple[int, int]:
    """Mark levels in daily_challenges as daily-only (excluded from adventure pool)."""
    cur.execute("UPDATE levels SET daily_eligible = FALSE")
    cleared = cur.rowcount
    cur.execute(
        """
        UPDATE levels l
        INNER JOIN (
            SELECT DISTINCT level_id FROM daily_challenges
        ) d ON d.level_id = l.level_id
        SET l.daily_eligible = TRUE
        """
    )
    flagged = cur.rowcount
    return cleared, flagged


def upsert_daily(cur, rows: List[Tuple]) -> None:
    sql = """
        INSERT INTO daily_challenges (challenge_date, level_id, total_solutions, notes)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            level_id = VALUES(level_id),
            total_solutions = VALUES(total_solutions),
            notes = VALUES(notes)
    """
    for chunk in batched(rows, 250):
        cur.executemany(sql, chunk)


def main() -> None:
    ap = argparse.ArgumentParser(description="Import catalog levels into MySQL.")
    ap.add_argument("--dry-run", action="store_true", help="Report only; no DB writes")
    ap.add_argument(
        "--levels-only",
        action="store_true",
        help="Skip daily_challenges import",
    )
    ap.add_argument(
        "--daily-only",
        action="store_true",
        help="Only refresh daily_challenges (levels must exist)",
    )
    ap.add_argument(
        "--sync-daily-eligible",
        action="store_true",
        help="Only sync levels.daily_eligible from daily_challenges table",
    )
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]

    if args.sync_daily_eligible:
        if args.dry_run:
            conn = connect()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT COUNT(DISTINCT level_id) FROM daily_challenges"
                    )
                    distinct_daily = cur.fetchone()[0]
                    cur.execute(
                        "SELECT COUNT(*) FROM levels WHERE daily_eligible = TRUE"
                    )
                    currently_flagged = cur.fetchone()[0]
                print(f"daily_challenges distinct levels: {distinct_daily}")
                print(f"levels currently daily_eligible: {currently_flagged}")
            finally:
                conn.close()
            return
        conn = connect()
        try:
            with conn.cursor() as cur:
                cleared, flagged = sync_daily_eligible_from_challenges(cur)
            conn.commit()
            print(f"daily_eligible cleared on {cleared} levels")
            print(f"daily_eligible set TRUE on {flagged} levels (adventure excludes these)")
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return

    levels_doc = read_json(root / "data" / "levels" / "levels.json")
    catalog_levels: List[dict] = list(levels_doc.get("levels", []))

    level_rows: List[Tuple] = []
    missing_solves = 0
    for lv in catalog_levels:
        level_id = str(lv.get("id", ""))
        if not level_id:
            continue
        solves_file = str(lv.get("solvesFile") or f"{level_id}.json")
        if not (root / "solves" / solves_file).exists():
            missing_solves += 1
        level_rows.append(level_row(root, lv))

    daily_rows = load_daily_rows(root)

    print(f"catalog levels: {len(level_rows)}")
    print(f"missing solve files: {missing_solves}")
    print(f"daily schedule rows: {len(daily_rows)}")

    if args.dry_run:
        return

    conn = connect()
    try:
        with conn.cursor() as cur:
            if not args.daily_only:
                upsert_levels(cur, level_rows)
                print(f"upserted levels: {len(level_rows)}")
            if not args.levels_only:
                upsert_daily(cur, daily_rows)
                print(f"upserted daily_challenges: {len(daily_rows)}")
            if not args.levels_only or args.daily_only:
                cleared, flagged = sync_daily_eligible_from_challenges(cur)
                print(
                    f"daily_eligible: {flagged} levels reserved for daily "
                    f"(excluded from adventure)"
                )
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM levels")
            levels_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM daily_challenges")
            daily_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM levels WHERE daily_eligible = TRUE")
            daily_pool = cur.fetchone()[0]
            print(f"db levels: {levels_n}")
            print(f"db daily_challenges: {daily_n}")
            print(f"db daily_eligible levels: {daily_pool}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
