#!/usr/bin/env python3
"""Rematch null solution_index rows in user_found_solutions against catalog solves.

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
    _mysql_connect,
    _normalize_placements,
    repair_user_progress_indices,
)
from lib.solve_match import (  # noqa: E402
    load_solves_file,
    match_catalog,
    parse_board_size,
    playable_placements,
)


def repair_sql_indexes(user_id: int | None = None) -> dict:
    try:
        conn = _mysql_connect()
    except Exception as err:
        return {"ok": False, "error": str(err)}

    fixed = 0
    scanned = 0
    try:
        with conn.cursor() as cur:
            if user_id is None:
                cur.execute(
                    """
                    SELECT found_id, user_id, level_id, placements_json
                    FROM user_found_solutions
                    WHERE solution_index IS NULL
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT found_id, user_id, level_id, placements_json
                    FROM user_found_solutions
                    WHERE solution_index IS NULL AND user_id = %s
                    """,
                    (user_id,),
                )
            rows = cur.fetchall() or []
            for row in rows:
                scanned += 1
                level_id = str(row.get("level_id") or "")
                placements = row.get("placements_json")
                if isinstance(placements, str):
                    try:
                        placements = json.loads(placements)
                    except json.JSONDecodeError:
                        placements = []
                placements = _normalize_placements(placements if isinstance(placements, list) else [])
                if not placements:
                    continue
                rows_n, cols_n = parse_board_size(level_id)
                known = load_solves_file(ROOT, level_id)
                if not known:
                    continue
                index, bonus = match_catalog(
                    playable_placements(placements), known, rows_n, cols_n
                )
                if index is None:
                    continue
                cur.execute(
                    """
                    UPDATE user_found_solutions
                    SET solution_index = %s, is_bonus = %s
                    WHERE found_id = %s
                    """,
                    (int(index), 1 if bonus else 0, row["found_id"]),
                )
                fixed += 1
            # Clear bogus bonus flag on indexed rows
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
        return {"ok": False, "error": str(err), "scanned": scanned, "fixed": fixed}
    finally:
        conn.close()
    return {"ok": True, "scanned": scanned, "fixed": fixed}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user", type=int, default=None)
    args = parser.parse_args()
    result = repair_sql_indexes(args.user)
    print(result)
    if args.user is not None:
        print(repair_user_progress_indices(ROOT, args.user))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
