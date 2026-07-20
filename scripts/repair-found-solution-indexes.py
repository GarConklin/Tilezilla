#!/usr/bin/env python3
"""Rematch null solution_index rows and rehash equiv keys after board-size fixes.

Usage:
  python scripts/repair-found-solution-indexes.py
  python scripts/repair-found-solution-indexes.py --user 900004
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lib.progress_store import (  # noqa: E402
    _equiv_hash,
    _mysql_connect,
    _normalize_placements,
    repair_user_progress_indices,
)
from lib.solve_match import (  # noqa: E402
    board_size_from_solves,
    equivalence_key,
    load_solves_file,
    match_catalog,
    playable_placements,
)


def repair_sql_indexes(user_id: int | None = None, verbose: bool = False) -> dict:
    try:
        conn = _mysql_connect()
    except Exception as err:
        return {"ok": False, "error": str(err)}

    fixed = 0
    rehashed = 0
    duplicates_removed = 0
    scanned = 0
    rematch_candidates = 0
    no_match = 0
    try:
        with conn.cursor() as cur:
            if user_id is None:
                cur.execute(
                    """
                    SELECT found_id, user_id, level_id, placements_json, solution_index, is_bonus
                    FROM user_found_solutions
                    ORDER BY found_id
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT found_id, user_id, level_id, placements_json, solution_index, is_bonus
                    FROM user_found_solutions
                    WHERE user_id = %s
                    ORDER BY found_id
                    """,
                    (user_id,),
                )
            rows = cur.fetchall() or []
            cache: dict[str, tuple[int, int, list]] = {}
            for row in rows:
                scanned += 1
                level_id = str(row.get("level_id") or "")
                placements = row.get("placements_json")
                if isinstance(placements, str):
                    try:
                        placements = json.loads(placements)
                    except json.JSONDecodeError:
                        placements = []
                placements = _normalize_placements(
                    placements if isinstance(placements, list) else []
                )
                if not placements:
                    continue

                if level_id not in cache:
                    rows_n, cols_n = board_size_from_solves(ROOT, level_id)
                    known = load_solves_file(ROOT, level_id) if rows_n and cols_n else []
                    cache[level_id] = (rows_n, cols_n, known)
                rows_n, cols_n, known = cache[level_id]
                if not rows_n or not cols_n:
                    continue

                playable = playable_placements(placements)
                equiv_h = _equiv_hash(equivalence_key(playable, rows_n, cols_n))
                cur.execute(
                    """
                    SELECT found_id FROM user_found_solutions
                    WHERE user_id = %s AND level_id = %s AND equiv_hash = %s
                      AND found_id <> %s
                    LIMIT 1
                    """,
                    (row["user_id"], level_id, equiv_h, row["found_id"]),
                )
                other = cur.fetchone()
                if other:
                    cur.execute(
                        "DELETE FROM user_found_solutions WHERE found_id = %s",
                        (row["found_id"],),
                    )
                    duplicates_removed += 1
                    if verbose:
                        print(
                            f"dup_removed {level_id} {row['found_id']} "
                            f"(kept {other['found_id']})"
                        )
                    continue

                cur.execute(
                    """
                    UPDATE user_found_solutions
                    SET equiv_hash = %s
                    WHERE found_id = %s AND equiv_hash <> %s
                    """,
                    (equiv_h, row["found_id"], equiv_h),
                )
                if cur.rowcount:
                    rehashed += 1

                if row.get("solution_index") is not None and not row.get("is_bonus"):
                    continue

                rematch_candidates += 1
                if not known:
                    if verbose:
                        print(f"no_solves {level_id} {row['found_id']}")
                    no_match += 1
                    continue

                index, bonus = match_catalog(playable, known, rows_n, cols_n)
                if index is None:
                    if verbose:
                        print(f"no_match {level_id} {row['found_id']}")
                    no_match += 1
                    continue

                cur.execute(
                    """
                    UPDATE user_found_solutions
                    SET solution_index = %s, is_bonus = %s, equiv_hash = %s
                    WHERE found_id = %s
                    """,
                    (int(index), 1 if bonus else 0, equiv_h, row["found_id"]),
                )
                fixed += 1
                if verbose:
                    print(f"fixed {level_id} {row['found_id']} -> {index}")

            # Indexed rows should never stay marked bonus.
            if user_id is None:
                cur.execute(
                    """
                    UPDATE user_found_solutions
                    SET is_bonus = 0
                    WHERE solution_index IS NOT NULL AND is_bonus = 1
                    """
                )
            else:
                cur.execute(
                    """
                    UPDATE user_found_solutions
                    SET is_bonus = 0
                    WHERE solution_index IS NOT NULL AND is_bonus = 1 AND user_id = %s
                    """,
                    (user_id,),
                )
        conn.commit()
    except Exception as err:
        conn.rollback()
        return {
            "ok": False,
            "error": str(err),
            "scanned": scanned,
            "fixed": fixed,
            "rehashed": rehashed,
            "duplicates_removed": duplicates_removed,
        }
    finally:
        conn.close()
    return {
        "ok": True,
        "scanned": scanned,
        "rematch_candidates": rematch_candidates,
        "fixed": fixed,
        "rehashed": rehashed,
        "duplicates_removed": duplicates_removed,
        "no_match": no_match,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user", type=int, default=None)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()
    result = repair_sql_indexes(args.user, verbose=args.verbose)
    print(result)
    if args.user is not None:
        print(repair_user_progress_indices(ROOT, args.user))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
