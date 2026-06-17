#!/usr/bin/env python3
"""Import Adventure rank + progression from LevelSystem.csv into MySQL.

Authoritative source: data/LevelSystem.csv
  Base_Lvl / Sub_Lvl → rank_id / sub_level
  pzzle_amt          → levels_required (puzzles in that Lx-y step)
  Adv_ID_Start       → reference only (puzzle map uses adventure_solution_distribution.csv)

Puzzle slots (level_id per Adv_ID) come from import-adventure-map.py.

  python scripts/import-adventure-progression.py
  python scripts/import-adventure-progression.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import pymysql
except ImportError:
    pymysql = None  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.adventure_ranks import load_adventure_ranks
from lib.level_system import derive_progression_from_level_system, level_system_path


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


def upsert_ranks(cur, repo_root: Path) -> None:
    sql = """
        INSERT INTO adventure_rank (
            rank_id, rank_code, rank_name, rank_description, badge_name, badge_image,
            badge_locked_image, badge_color, unlock_title, unlock_message,
            display_order, is_active
        ) VALUES (%s, %s, %s, %s, %s, %s, NULL, NULL, NULL, NULL, %s, TRUE)
        ON DUPLICATE KEY UPDATE
            rank_code = VALUES(rank_code),
            rank_name = VALUES(rank_name),
            rank_description = VALUES(rank_description),
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
                row["rank_description"],
                row["rank_name"],
                row["badge_image"],
                row["display_order"],
            ),
        )


def upsert_progression(cur, rows: list) -> None:
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


def main() -> None:
    ap = argparse.ArgumentParser(description="Import adventure progression from LevelSystem.csv.")
    ap.add_argument(
        "--csv",
        default="data/LevelSystem.csv",
        help="LevelSystem CSV path",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    csv_path = (root / args.csv).resolve()
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    ranks = load_adventure_ranks(root)
    max_rank_id = max(r["rank_id"] for r in ranks)
    prog_rows = derive_progression_from_level_system(csv_path, max_rank_id=max_rank_id)

    print(f"CSV: {csv_path}")
    print(f"ranks: {len(ranks)}")
    print(f"progression steps: {len(prog_rows)}")
    last = prog_rows[-1]
    print(
        f"cumulative at L{last['rank_id']}-{last['sub_level']}: "
        f"{last['cumulative_levels_required']} "
        f"(levels_required={last['levels_required']})"
    )
    print("sample L1-1:", prog_rows[0])
    print("sample L2-1:", next(r for r in prog_rows if r["rank_id"] == 2 and r["sub_level"] == 1))

    if args.dry_run:
        return

    conn = connect()
    try:
        with conn.cursor() as cur:
            upsert_ranks(cur, root)
            upsert_progression(cur, prog_rows)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM adventure_rank")
            ranks_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_progression")
            prog_n = cur.fetchone()[0]
            print(f"db adventure_rank: {ranks_n}")
            print(f"db adventure_progression: {prog_n}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
