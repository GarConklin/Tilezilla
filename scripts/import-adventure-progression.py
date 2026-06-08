#!/usr/bin/env python3
"""Import Adventure rank + progression from CSV into MySQL.

Authoritative source: data/adventure_solution_distribution-fn.csv
  Base_Lvl  → rank_id (L1 → 1)
  Sub_Lvl   → sub_level
  pzzle_amt → cumulative puzzle index within rank

Derived (not hardcoded in app code):
  levels_required            = pzzle_amt (puzzles in that Lx-y step)
  cumulative_levels_required = running sum of levels_required across all steps

Prefer import-adventure-map.py when the full puzzle map CSV is available.

  python scripts/import-adventure-progression.py
  python scripts/import-adventure-progression.py --dry-run
  python scripts/import-adventure-progression.py --csv data/adventure_solution_distribution-fn.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import re
from pathlib import Path
from typing import List, Tuple

try:
    import pymysql
except ImportError:
    pymysql = None  # type: ignore

RANKS: List[Tuple[int, str, str, int]] = [
    (1, "L1", "Wanderer", 1),
    (2, "L2", "Pathfinder", 2),
    (3, "L3", "Trailblazer", 3),
    (4, "L4", "Navigator", 4),
    (5, "L5", "Waymaker", 5),
    (6, "L6", "Route Master", 6),
    (7, "L7", "Grand Cartographer", 7),
    (8, "L8", "Vaultwalker", 8),
]


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


def parse_rank_code(base_lvl: str) -> int:
    m = re.match(r"^L(\d+)$", str(base_lvl).strip(), re.I)
    if not m:
        raise ValueError(f"Invalid Base_Lvl: {base_lvl!r}")
    return int(m.group(1))


def load_progression_rows(csv_path: Path) -> List[dict]:
    rows: List[dict] = []
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            base = (raw.get("Base_Lvl") or raw.get("base_lvl") or "").strip()
            sub = (raw.get("Sub_Lvl") or raw.get("sub_lvl") or "").strip()
            amt = (raw.get("pzzle_amt") or raw.get("Pzzle_amt") or "").strip()
            if not base or not sub or not amt:
                continue
            rows.append(
                {
                    "rank_id": parse_rank_code(base),
                    "sub_level": int(sub),
                    "pzzle_amt": int(amt),
                }
            )
    rows.sort(key=lambda r: (r["rank_id"], r["sub_level"]))
    if len(rows) != 80:
        raise SystemExit(f"Expected 80 progression rows, got {len(rows)} from {csv_path}")
    return rows


def derive_progression(rows: List[dict]) -> List[dict]:
    cumulative = 0
    out: List[dict] = []
    for row in rows:
        levels_required = row["pzzle_amt"]
        if levels_required <= 0:
            raise SystemExit(
                f"Non-positive levels_required at L{row['rank_id']}-{row['sub_level']}: "
                f"pzzle_amt={levels_required}"
            )
        cumulative += levels_required
        out.append(
            {
                "rank_id": row["rank_id"],
                "sub_level": row["sub_level"],
                "levels_required": levels_required,
                "cumulative_levels_required": cumulative,
            }
        )
    return out


def upsert_ranks(cur) -> None:
    sql = """
        INSERT INTO adventure_rank (
            rank_id, rank_code, rank_name, badge_name, badge_image,
            badge_locked_image, badge_color, unlock_title, unlock_message,
            display_order, is_active
        ) VALUES (%s, %s, %s, NULL, NULL, NULL, NULL, NULL, NULL, %s, TRUE)
        ON DUPLICATE KEY UPDATE
            rank_code = VALUES(rank_code),
            rank_name = VALUES(rank_name),
            display_order = VALUES(display_order),
            is_active = VALUES(is_active)
    """
    for rank_id, code, name, display_order in RANKS:
        cur.execute(sql, (rank_id, code, name, display_order))


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


def main() -> None:
    ap = argparse.ArgumentParser(description="Import adventure progression from CSV.")
    ap.add_argument(
        "--csv",
        default="data/adventure_solution_distribution-fn.csv",
        help="Progression CSV path",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    csv_path = (root / args.csv).resolve()
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    raw_rows = load_progression_rows(csv_path)
    prog_rows = derive_progression(raw_rows)

    print(f"CSV: {csv_path}")
    print(f"ranks: {len(RANKS)}")
    print(f"progression steps: {len(prog_rows)}")
    print(
        f"cumulative at L8-10: {prog_rows[-1]['cumulative_levels_required']} "
        f"(levels_required={prog_rows[-1]['levels_required']})"
    )
    print("sample L1-1:", prog_rows[0])
    print("sample L2-1:", next(r for r in prog_rows if r["rank_id"] == 2 and r["sub_level"] == 1))

    if args.dry_run:
        return

    conn = connect()
    try:
        with conn.cursor() as cur:
            upsert_ranks(cur)
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
